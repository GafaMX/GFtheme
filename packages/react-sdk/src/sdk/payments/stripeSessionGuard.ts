/**
 * El IIFE usa el secret como key del provider. Preparamos process → compra →
 * updates antes de entregarle el secret, y cortamos el update idéntico que
 * ejecuta su formulario al montar. No intervenimos en Stripe.confirm().
 */
const UPDATE_PATH = /\/api\/stripe\.updateinitialpayment(?:\?|$)/i;
const PROCESS_PATH = /\/api\/stripe\.processinitialpayment(?:\?|$)/i;
const COMPLETE_PATH = /\/api\/stripe\.completeinitialpayment(?:\?|$)/i;
const DEBOUNCE_MS = 2000;
export const STRIPE_SESSION_PROGRESS_EVENT = "gafa-stripe-session-progress";

type PaymentData = { message?: string; client_secret?: string; [key: string]: unknown };

/** Vive en CheckoutModal, fuera de PayPanel y del provider que se remontan. */
export type StripeCheckoutState = {
  saveCard?: boolean;
  /** Elección del carrito; el estado local del IIFE no puede restaurarla. */
  recurringPayment?: boolean;
  revision?: number;
  tail?: Promise<unknown>;
};

type Session = {
  checkout: StripeCheckoutState;
  last?: { key: string; at: number };
};

type WidgetSession = Session & {
  element: HTMLElement;
  apiUrl: string;
  updateBody: Record<string, unknown>;
  onInitialPayment: (data: PaymentData, created: boolean) => unknown;
  active: boolean;
  pending: number;
  progressAt: number;
  prepared: boolean;
  preparedRevision?: number;
  requestInit?: RequestInit;
  delivered?: string;
};

const state = {
  orig: undefined as typeof fetch | undefined,
  installed: false,
  fallback: new Map<string, Session>(),
  widgets: new Set<WidgetSession>(),
  tokens: new Map<string, WidgetSession>(),
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

function bodyKey(body: Record<string, unknown>): string {
  // El orden de las propiedades no forma parte del contrato del POST.
  return JSON.stringify(Object.entries(body).filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)));
}

function noChange(token: unknown): Response {
  return jsonResponse({ message: token || "No hubo cambios" });
}

function progress(session: WidgetSession): void {
  session.progressAt = Date.now();
  session.element.dispatchEvent(new Event(STRIPE_SESSION_PROGRESS_EVENT, { bubbles: true }));
}

function latest(session: Session, revision: number): boolean {
  return session.checkout.revision === revision && (!("active" in session) || session.active === true);
}

async function deliver(session: WidgetSession, data: PaymentData, created: boolean, echo = false): Promise<void> {
  const key = JSON.stringify([data.message, data.client_secret]);
  if ((echo && session.delivered === key) || !session.active) return;
  session.delivered = key;
  await session.onInitialPayment(data, created);
}

/** Registro limitado al widget SDK; el resto de fetch conserva su contrato. */
export function registerStripeSession(options: {
  element: HTMLElement;
  apiUrl: string;
  checkout: StripeCheckoutState;
  updateBody: Record<string, unknown>;
  onInitialPayment: WidgetSession["onInitialPayment"];
}): { dispose: () => void; onEvent: (data: unknown, created: boolean) => void } {
  const session: WidgetSession = {
    ...options, active: true, pending: 0, progressAt: Date.now(), prepared: false,
  };
  state.widgets.add(session);
  return {
    dispose: () => {
      session.active = false;
      state.widgets.delete(session);
      for (const [token, owner] of state.tokens) if (owner === session) state.tokens.delete(token);
    },
    // El IIFE vuelve a emitir el par que ya se registró antes de montar.
    onEvent: (data, created) => { void deliver(session, data as PaymentData, created, true); },
  };
}

export function stripeSessionStatus(container: Element): { ready: boolean; progressAt: number; revision: number } | undefined {
  const session = [...state.widgets].find(({ element }) => container.contains(element));
  return session && {
    ready: session.prepared && session.preparedRevision === session.checkout.revision && session.pending === 0,
    progressAt: session.progressAt, revision: session.checkout.revision ?? 0,
  };
}

function findWidget(url: string, body: Record<string, unknown>, process: boolean): WidgetSession | undefined {
  if (!process && typeof body.tokenInput === "string") {
    const owner = state.tokens.get(body.tokenInput);
    if (owner) return owner;
  }
  return [...state.widgets].find((session) => session.active &&
    url.startsWith(`${session.apiUrl}/api/stripe.`) &&
    body.customer_email === session.updateBody.customer_email &&
    JSON.stringify(body.lineItems) === JSON.stringify(session.updateBody.lineItems));
}

/** Todas las sustituciones de sesión, incluidos cupones, comparten revisión y cola. */
async function coordinatePayment(
  input: RequestInfo | URL, init: RequestInit, body: Record<string, unknown>,
  process: boolean, widget?: WidgetSession, seed?: PaymentData,
): Promise<Response> {
  const url = requestUrl(input);
  const update = !process;
  const fallbackKey = `${url}::${body.tokenInput ?? ""}`;
  const session: Session = widget ?? state.fallback.get(fallbackKey) ?? { checkout: {} };
  if (!widget) state.fallback.set(fallbackKey, session);
  // A→B→A debe llegar al backend: B pudo aplicarse aunque su respuesta
  // resulte superada. No reutilizar el éxito de A anterior a B.
  if (seed || (update && session.last?.key !== bodyKey(body))) session.last = undefined;
  const revision = session.checkout.revision = (session.checkout.revision ?? 0) + 1;
  if (widget) { widget.pending += 1; progress(widget); }
  const originalFetch = state.orig!;
  const run = async (): Promise<Response> => {
    if (!latest(session, revision)) return noChange(body.tokenInput);
    const sent = new Set<string>();
    const sendUpdate = async (updateBody: Record<string, unknown>): Promise<Response> => {
      const key = bodyKey(updateBody);
      if (sent.has(key) || (session.last?.key === key && Date.now() - session.last.at < DEBOUNCE_MS)) return noChange(updateBody.tokenInput);
      sent.add(key);
      const response = await originalFetch(process ? url.replace(/stripe\.processinitialpayment/i, "stripe.updateinitialpayment") : input, {
        ...init, body: JSON.stringify(updateBody),
      });
      if (response.ok && latest(session, revision)) session.last = { key, at: Date.now() };
      return response;
    };
    let response = seed ? jsonResponse(seed) : process ? await originalFetch(input, init) : await sendUpdate(body);
    if (!latest(session, revision)) return noChange(body.tokenInput);
    if (!widget || !response.ok) return response;
    let data = await response.clone().json() as PaymentData;
    let created = process;
    // Cada token nuevo requiere registrar la compra antes de otro update.
    // Con el mismo token/body, el siguiente update es el no-op de montaje.
    while (data.client_secret && latest(session, revision)) {
      if (data.message) state.tokens.set(data.message, widget);
      progress(widget);
      // Conservar el payload de onPaymentUpdated del IIFE, además del orden.
      await deliver(widget, created ? data : {
        subscriptionId: (process ? widget.updateBody : body).recurringPayment ? data.subscriptionId : null,
        client_secret: data.client_secret, webToken: data.webToken, message: data.message || "",
      }, created);
      if (!latest(session, revision)) return noChange(data.message);
      progress(widget); // initial-purchase también forma parte de la cadena.
      const nextBody = {
        ...(process ? widget.updateBody : body), tokenInput: data.message,
        saveCard: widget.checkout.saveCard ?? false,
        recurringPayment: widget.checkout.recurringPayment ?? (process ? widget.updateBody : body).recurringPayment,
      };
      const next = await sendUpdate(nextBody);
      if (!next.ok) return next;
      if (!latest(session, revision)) return noChange(data.message);
      const nextData = await next.clone().json() as PaymentData;
      if (!nextData.client_secret) break;
      response = next;
      data = nextData;
      created = false;
    }
    if (session.last) session.last.at = Date.now();
    widget.prepared = true;
    widget.preparedRevision = revision;
    return latest(session, revision) ? response : noChange(data.message);
  };
  const result = (session.checkout.tail ?? Promise.resolve()).catch(() => undefined).then(run);
  session.checkout.tail = result;
  try { return await result; } finally {
    if (widget) { widget.pending -= 1; progress(widget); }
  }
}

const discountReplays = new WeakSet<Event>();
function onDiscountAdded(event: Event): void {
  if (discountReplays.has(event)) return;
  const detail = (event as CustomEvent).detail;
  if (!detail || typeof detail.client_secret !== "string" || !detail.client_secret ||
      typeof detail.checkout_token !== "string" || !detail.checkout_token) return;
  const widgets = [...state.widgets].filter((widget) => widget.active);
  const widget = state.tokens.get(detail.previous_checkout_token ?? detail.checkout_token) ??
    (widgets.length === 1 ? widgets[0] : undefined);
  if (!widget) return;
  // Asociar ANTES de entregar el evento al IIFE. No montar el secret intermedio
  // del descuento: primero registrar compra y esperar todos sus updates.
  event.stopImmediatePropagation();
  state.tokens.set(detail.checkout_token, widget);
  const body = {
    ...widget.updateBody, tokenInput: detail.checkout_token,
    saveCard: widget.checkout.saveCard ?? false,
    recurringPayment: widget.checkout.recurringPayment ?? widget.updateBody.recurringPayment,
  };
  const pending = coordinatePayment(`${widget.apiUrl}/api/stripe.updateinitialpayment`, {
    ...widget.requestInit, method: "POST", body: JSON.stringify(body),
  }, body, false, widget, { message: detail.checkout_token, client_secret: detail.client_secret });
  const revision = widget.checkout.revision;
  void pending.then(async (response) => {
    const data = await response.json() as PaymentData;
    if (!response.ok) throw new Error("No pudimos actualizar el descuento de Stripe.");
    if (!latest(widget, revision!) || !data.client_secret) return;
    const replay = new CustomEvent("buq__discount_added", { detail: {
      ...detail, checkout_token: data.message, client_secret: data.client_secret,
    } });
    discountReplays.add(replay);
    window.dispatchEvent(replay);
  }).catch((error) => {
    if (latest(widget, revision!)) widget.element.dispatchEvent(new CustomEvent("initial-payment-update-error", {
      detail: { message: error instanceof Error ? error.message : "No pudimos actualizar el descuento." },
    }));
  });
}

export const STRIPE_UPDATE_DEBOUNCE_MS = DEBOUNCE_MS;

export function installStripeSessionFetchGuard(): void {
  if (state.installed || typeof window === "undefined" || typeof fetch !== "function") return;
  state.orig = fetch.bind(window);
  state.installed = true;
  window.addEventListener("buq__discount_added", onDiscountAdded, true);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const method = (init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    const process = PROCESS_PATH.test(url);
    const update = UPDATE_PATH.test(url);
    const complete = COMPLETE_PATH.test(url);
    if (method !== "POST" || (!process && !update && !complete) || typeof init?.body !== "string") {
      return state.orig!(input, init);
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(init.body); } catch { return state.orig!(input, init); }
    if (!body || typeof body !== "object") return state.orig!(input, init);
    const widget = findWidget(url, body, process);
    if ((process || complete) && !widget) return state.orig!(input, init);
    if (widget) {
      widget.requestInit = init;
      // vw solo activa saveCard explícitamente; false es su valor de montaje.
      // Preservamos la elección incluso cuando una nueva key recrea vw.
      if (body.saveCard === true) widget.checkout.saveCard = true;
      if (!process) {
        body.saveCard = widget.checkout.saveCard ?? body.saveCard;
        if (typeof widget.checkout.recurringPayment === "boolean") {
          body.recurringPayment = widget.checkout.recurringPayment;
        }
      }
    }
    if (widget && update) widget.updateBody = { ...body };
    if (complete) {
      // No reintentamos ni duplicamos complete/confirm: restauramos las opciones.
      return state.orig!(input, { ...init, body: JSON.stringify(body) });
    }
    return coordinatePayment(input, init, body, process, widget);
  }) as typeof fetch;
}

/** Tests. */
export function resetStripeSessionFetchGuardForTests(): void {
  if (state.installed && typeof window !== "undefined" && state.orig) window.fetch = state.orig;
  if (typeof window !== "undefined") window.removeEventListener("buq__discount_added", onDiscountAdded, true);
  state.installed = false;
  state.fallback.clear();
  state.widgets.clear();
  state.tokens.clear();
}

/** StrictMode monta→cleanup→monta en el mismo tick; solo el segundo crea orden. */
export function afterStrictModePass(run: () => void): () => void {
  const id = window.setTimeout(run, 0);
  return () => window.clearTimeout(id);
}
