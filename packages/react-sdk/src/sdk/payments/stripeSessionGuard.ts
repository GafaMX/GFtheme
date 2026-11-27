/** Checkout state machine. The IIFE is a consumer, never the owner of readiness. */
import { installStripeSurfaceTracking } from "./stripeSurface";

const UPDATE_PATH = /\/api\/stripe\.updateinitialpayment(?:\?|$)/i;
const PROCESS_PATH = /\/api\/stripe\.processinitialpayment(?:\?|$)/i;
const COMPLETE_PATH = /\/api\/stripe\.completeinitialpayment(?:\?|$)/i;
export const STRIPE_SESSION_PROGRESS_EVENT = "gafa-stripe-session-progress";
export const STRIPE_UPDATE_DEBOUNCE_MS = 2000;
export const STRIPE_PREPARATION_TIMEOUT_MS = 30_000;

type PaymentData = { message?: string; client_secret?: string; [key: string]: unknown };
export type StripePreparationContext = { revision: number; signal: AbortSignal };
export type StripeCheckoutState = { saveCard?: boolean; recurringPayment?: boolean; revision?: number };
type Phase = "idle" | "preparing" | "ready" | "confirming" | "done" | "error" | "disposed";
type Operation = StripePreparationContext & {
  controller: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  promise: Promise<PaymentData>;
};
type WidgetSession = {
  element: HTMLElement; apiUrl: string; checkout: StripeCheckoutState;
  updateBody: Record<string, unknown>;
  onInitialPayment: (data: PaymentData, created: boolean, context: StripePreparationContext) => unknown;
  phase: Phase; revision: number; progressAt: number; operation?: Operation;
  data?: PaymentData; last?: string;
  requestInit?: RequestInit; consumer: boolean;
  surface?: { secret: string; node: Element; ready: boolean; destroy: () => void; provider: object };
  observer: MutationObserver;
  blockSubmit: (event: Event) => void;
};
const state = {
  orig: undefined as typeof fetch | undefined, installed: false,
  widgets: new Set<WidgetSession>(), tokens: new Map<string, WidgetSession | null>(),
  fallback: new Map<string, { key: string; at: number }>(),
  secrets: new Set<string>(),
  restoreSurface: undefined as (() => void) | undefined,
};
const owners = new WeakMap<StripeCheckoutState, WidgetSession>();
const byElement = new WeakMap<Element, WidgetSession>();
const providerOwners = new WeakMap<object, WidgetSession>();
const confirmations = new WeakMap<StripeCheckoutState, object>();
const holds = new WeakMap<StripeCheckoutState, Set<symbol>>();
const held = (s: WidgetSession) => Boolean(holds.get(s.checkout)?.size);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json" },
});
const noChange = (token: unknown) => json({ message: token || "No hubo cambios" });
const keyOf = (body: Record<string, unknown>) => JSON.stringify(Object.entries(body)
  .filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)));
const urlOf = (input: RequestInfo | URL) => typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
const active = (s: WidgetSession) => s.phase !== "disposed" && owners.get(s.checkout) === s;
const current = (s: WidgetSession, op: Operation) => active(s) && s.operation === op && s.revision === op.revision &&
  s.checkout.revision === op.revision && !op.signal.aborted;
const abortError = () => new DOMException("Preparación de Stripe cancelada", "AbortError");

/** Also releases callers when a transport/mock does not honour AbortSignal. */
export function withStripeAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? abortError());
    if (signal.aborted) { void promise.catch(() => undefined); abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
function surfaceReady(s: WidgetSession): boolean {
  return !held(s) && Boolean(s.surface?.ready && s.surface.secret === s.data?.client_secret &&
    s.element.isConnected && s.surface.node.isConnected && s.element.contains(s.surface.node) &&
    s.surface.node.querySelector("iframe"));
}
function changed(s: WidgetSession): void {
  s.element.dispatchEvent(new CustomEvent(STRIPE_SESSION_PROGRESS_EVENT, {
    bubbles: true, detail: { revision: s.revision, phase: s.phase },
  }));
}
function progress(s: WidgetSession, op: Operation): void {
  if (!current(s, op)) return;
  clearTimeout(op.timer);
  s.progressAt = Date.now();
  op.timer = setTimeout(() => fail(s, op, new Error("Stripe no respondió a tiempo. Intenta de nuevo.")), STRIPE_PREPARATION_TIMEOUT_MS);
  changed(s);
}
function fail(s: WidgetSession, op: Operation, error: unknown): void {
  if (!current(s, op)) return;
  clearTimeout(op.timer);
  s.phase = "error";
  op.controller.abort(error);
  changed(s);
  s.element.dispatchEvent(new CustomEvent("initial-payment-update-error", {
    bubbles: true, detail: { revision: op.revision, err: error,
      message: error instanceof Error ? error.message : "No pudimos preparar el pago." },
  }));
}
function dispose(s: WidgetSession): void {
  if (!active(s)) return;
  s.phase = "disposed";
  s.revision = s.checkout.revision = (s.checkout.revision ?? 0) + 1;
  clearTimeout(s.operation?.timer);
  s.operation?.controller.abort(abortError());
  s.observer.disconnect();
  s.surface?.destroy();
  s.surface = undefined;
  // The capture gate remains on the detached generation until its node is collected.
  // Token tombstones reject old complete calls without retaining detached DOM trees.
  for (const [token, owner] of state.tokens) if (owner === s) state.tokens.set(token, null);
  changed(s);
  state.widgets.delete(s);
}

/** Validation itself does not replace the server session, but may not race a charge. */
export function blockStripeCheckout(checkout: StripeCheckoutState, signal?: AbortSignal): () => void {
  const token = Symbol();
  const pending = holds.get(checkout) ?? new Set<symbol>();
  holds.set(checkout, pending); pending.add(token);
  const s = owners.get(checkout); if (s) changed(s);
  const release = () => {
    pending.delete(token); signal?.removeEventListener("abort", release);
    const current = owners.get(checkout); if (current) changed(current);
  };
  signal?.addEventListener("abort", release, { once: true });
  if (signal?.aborted) release();
  return release;
}
export function invalidateStripeCheckout(checkout: StripeCheckoutState): void {
  const s = owners.get(checkout);
  if (s) dispose(s);
  else checkout.revision = (checkout.revision ?? 0) + 1;
}
export function stripeSessionStatus(container: Element) {
  const element = container.matches?.("stripe-payment-element") ? container : container.querySelector("stripe-payment-element");
  const s = element ? byElement.get(element) : undefined;
  return s && { ready: s.phase === "ready" && surfaceReady(s), prepared: s.phase === "ready",
    phase: s.phase, progressAt: s.progressAt, revision: s.revision };
}

export function registerStripeSession(options: {
  element: HTMLElement; apiUrl: string; checkout: StripeCheckoutState;
  updateBody: Record<string, unknown>; onInitialPayment: WidgetSession["onInitialPayment"];
}): { dispose: () => void; onEvent: (data: unknown, created: boolean) => void } {
  const previous = owners.get(options.checkout);
  if (previous) { dispose(previous); state.widgets.delete(previous); }
  const s: WidgetSession = {
    ...options, phase: "idle", revision: options.checkout.revision ?? 0, progressAt: Date.now(),
    consumer: false,
    observer: new MutationObserver(() => changed(s)),
    blockSubmit: (event) => {
      if (s.phase !== "ready" || !surfaceReady(s)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    },
  };
  owners.set(options.checkout, s);
  byElement.set(s.element, s);
  s.observer.observe(s.element, { childList: true, subtree: true });
  s.element.addEventListener("submit", s.blockSubmit, true);
  state.widgets.add(s);
  return {
    dispose: () => dispose(s),
    // Preparation has already registered every accepted response. Ignore IIFE echoes.
    onEvent: () => undefined,
  };
}

/** Stripe mount/ready/confirm callbacks, bound to the actual provider's secret. */
export const stripeSurfaceLifecycle = {
  owns(secret: string) { return state.secrets.has(secret); },
  mount(secret: string, node: Element, destroy: () => void, provider: object) {
    const s = [...state.widgets].find((session) => session.element.contains(node));
    if (!s || s.phase !== "ready" || secret !== s.data?.client_secret || !node.isConnected) return false;
    const previous = s.surface;
    s.surface = { secret, node, ready: false, destroy, provider };
    providerOwners.set(provider, s);
    if (previous && previous.node !== node) previous.destroy();
    changed(s); return true;
  },
  ready(secret: string, node: Element) {
    const s = [...state.widgets].find((session) => session.surface?.node === node && session.surface.secret === secret);
    if (s?.surface) { s.surface.ready = true; changed(s); }
  },
  unmount(secret: string, node: Element) {
    const s = [...state.widgets].find((session) => session.surface?.node === node && session.surface.secret === secret);
    if (s) { s.surface = undefined; changed(s); }
  },
  canConfirm(secret: string, provider: object) {
    const s = providerOwners.get(provider);
    if (!s || !active(s) || confirmations.has(s.checkout) || s.phase !== "confirming" ||
        s.data?.client_secret !== secret || s.surface?.provider !== provider || !surfaceReady(s)) return false;
    // Stripe.confirm itself cannot be aborted. Freeze further mutations until it settles.
    confirmations.set(s.checkout, provider);
    return true;
  },
  confirmed(secret: string, success: boolean, provider: object) {
    const s = providerOwners.get(provider);
    if (!s || confirmations.get(s.checkout) !== provider) return;
    confirmations.delete(s.checkout);
    if (active(s) && s.phase === "confirming" && s.data?.client_secret === secret && s.surface?.provider === provider) {
      s.phase = success ? "done" : "ready"; changed(s);
    }
  },
};

function findWidget(url: string, body: Record<string, unknown>, process: boolean) {
  if (!process && typeof body.tokenInput === "string" && state.tokens.has(body.tokenInput)) return state.tokens.get(body.tokenInput);
  return [...state.widgets].find((s) => active(s) && url.startsWith(`${s.apiUrl}/api/stripe.`) &&
    body.customer_email === s.updateBody.customer_email && keyOf({ items: body.lineItems }) === keyOf({ items: s.updateBody.lineItems }));
}
function effectiveBody(s: WidgetSession, body: Record<string, unknown>) {
  const frequency = Number(s.updateBody.paymentFrequency);
  const recurring = (s.checkout.recurringPayment ?? body.recurringPayment) === true && Number.isInteger(frequency) && frequency > 0;
  s.checkout.recurringPayment = recurring;
  return { ...body, saveCard: s.checkout.saveCard ?? false, recurringPayment: recurring,
    paymentFrequency: recurring ? frequency : null };
}
async function prepare(s: WidgetSession, input: RequestInfo | URL, init: RequestInit,
  body: Record<string, unknown>, process: boolean, seed?: PaymentData): Promise<PaymentData> {
  s.operation?.controller.abort(abortError());
  clearTimeout(s.operation?.timer);
  const controller = new AbortController();
  const op: Operation = { revision: s.checkout.revision = (s.checkout.revision ?? 0) + 1,
    signal: controller.signal, controller, promise: Promise.resolve({}) };
  s.operation = op; s.revision = op.revision; s.phase = "preparing"; s.last = undefined;
  progress(s, op);
  const run = async () => {
    const send = async (url: RequestInfo | URL, payload: Record<string, unknown>) => {
      const response = await withStripeAbort(state.orig!(url, { ...init, signal: op.signal, body: JSON.stringify(payload) }), op.signal);
      if (!response.ok) throw new Error("No pudimos preparar la sesión de Stripe.");
      const data = await withStripeAbort(response.clone().json() as Promise<PaymentData>, op.signal);
      if (!current(s, op)) throw abortError();
      progress(s, op); return data;
    };
    const updateUrl = `${s.apiUrl}/api/stripe.updateinitialpayment`;
    let data = seed ?? await send(input, body);
    let created = process && !seed;
    const sent = new Set<string>();
    if (!process && !seed) sent.add(keyOf(body));
    while (current(s, op)) {
      if (!data.client_secret || !data.message) throw new Error("Stripe no devolvió una sesión de pago válida.");
      s.data = data;
      state.secrets.add(data.client_secret);
      if (data.message) state.tokens.set(data.message, s);
      await withStripeAbort(Promise.resolve(s.onInitialPayment(created ? data : {
        ...data, subscriptionId: body.recurringPayment ? data.subscriptionId : null,
      }, created, op)), op.signal);
      if (!current(s, op)) throw abortError();
      progress(s, op);
      const nextBody = effectiveBody(s, { ...s.updateBody, tokenInput: data.message });
      const key = keyOf(nextBody);
      s.last = key;
      if (sent.has(key)) break;
      sent.add(key);
      const next = await send(updateUrl, nextBody);
      if (!next.client_secret) break;
      data = next; created = false;
    }
    if (!current(s, op)) throw abortError();
    clearTimeout(op.timer);
    s.data = data; s.phase = "ready"; changed(s);
    return data;
  };
  op.promise = run().catch((error) => {
    if (current(s, op)) fail(s, op, error);
    // Consumers of superseded operations follow the current revision below.
    throw error;
  });
  return op.promise;
}
async function latestData(s: WidgetSession): Promise<PaymentData> {
  while (active(s)) {
    const op = s.operation;
    if (!op) throw abortError();
    try {
      const data = await op.promise;
      if (s.operation === op && s.phase === "ready") return data;
    } catch (error) {
      if (s.operation === op) throw error;
    }
  }
  throw abortError();
}
const replays = new WeakSet<Event>();
function replay(s: WidgetSession) {
  if (!s.consumer || s.phase !== "ready" || !s.data?.client_secret) return;
  const event = new CustomEvent("buq__discount_added", { detail: {
    checkout_token: s.data.message, client_secret: s.data.client_secret,
  } });
  replays.add(event); window.dispatchEvent(event);
}
function onDiscount(event: Event) {
  if (replays.has(event)) return;
  const d = (event as CustomEvent).detail;
  if (!d?.client_secret || !d.checkout_token) return;
  const widgets = [...state.widgets].filter(active);
  const origin = d.previous_checkout_token ?? d.checkout_token;
  if (state.tokens.has(origin) && state.tokens.get(origin) === null) { event.stopImmediatePropagation(); return; }
  const s = state.tokens.get(origin) ?? (widgets.length === 1 ? widgets[0] : undefined);
  if (!s || !active(s)) return;
  event.stopImmediatePropagation();
  if (confirmations.has(s.checkout) || s.phase === "done") return;
  state.tokens.set(d.checkout_token, s);
  const body = effectiveBody(s, { ...s.updateBody, tokenInput: d.checkout_token });
  void prepare(s, `${s.apiUrl}/api/stripe.updateinitialpayment`, {
    ...s.requestInit, method: "POST",
  }, body, false, { message: d.checkout_token, client_secret: d.client_secret })
    .then(() => replay(s)).catch(() => undefined);
}
export function installStripeSessionFetchGuard(): void {
  if (state.installed || typeof window === "undefined") return;
  state.orig = fetch.bind(window); state.installed = true;
  state.restoreSurface = installStripeSurfaceTracking(stripeSurfaceLifecycle);
  window.addEventListener("buq__discount_added", onDiscount, true);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    const process = PROCESS_PATH.test(url), update = UPDATE_PATH.test(url), complete = COMPLETE_PATH.test(url);
    if (init?.method?.toUpperCase() !== "POST" || (!process && !update && !complete) || typeof init.body !== "string") return state.orig!(input, init);
    let body: Record<string, unknown>;
    try { body = JSON.parse(init.body); } catch { return state.orig!(input, init); }
    if (!body || typeof body !== "object") return state.orig!(input, init);
    if (!process && typeof body.tokenInput === "string" && state.tokens.has(body.tokenInput) && state.tokens.get(body.tokenInput) === null) {
      return complete ? json({ message: "La sesión de pago cambió." }, 409) : noChange(body.tokenInput);
    }
    const s = findWidget(url, body, process);
    if (!s) {
      // Preserve the legacy update contract outside SDK checkout widgets.
      if (!update) return state.orig!(input, init);
      const key = `${url}::${body.tokenInput ?? ""}`, previous = state.fallback.get(key);
      if (previous?.key === keyOf(body) && Date.now() - previous.at < STRIPE_UPDATE_DEBOUNCE_MS) return noChange(body.tokenInput);
      const response = await state.orig!(input, init);
      if (response.ok) state.fallback.set(key, { key: keyOf(body), at: Date.now() });
      return response;
    }
    if (confirmations.has(s.checkout) || s.phase === "done") return json({ message: "El pago ya está en curso o terminó." }, 409);
    if (!active(s)) return complete ? json({ message: "La sesión de pago cambió." }, 409) : noChange(body.tokenInput);
    if (body.saveCard === true) s.checkout.saveCard = true;
    const rawBody = body;
    body = effectiveBody(s, body);
    if (complete) {
      if (s.phase !== "ready" || !surfaceReady(s) || body.tokenInput !== s.data?.message) return json({ message: "El formulario de pago todavía no está listo." }, 409);
      const revision = s.revision;
      s.phase = "confirming"; changed(s);
      try {
        const response = await withStripeAbort(state.orig!(input, { ...init, signal: s.operation?.signal, body: JSON.stringify(body) }), s.operation!.signal);
        if (!active(s) || s.revision !== revision || s.phase !== "confirming") return json({ message: "La sesión de pago cambió." }, 409);
        if (!response.ok) { s.phase = "ready"; changed(s); }
        return response;
      } catch (error) { if (s.revision === revision && active(s)) { s.phase = "ready"; changed(s); } throw error; }
    }
    s.requestInit = init;
    if (update) {
      // vw installs its discount listener before its mount update effect.
      const firstConsumer = !s.consumer;
      s.consumer = true;
      if (s.phase === "preparing" && (firstConsumer || rawBody.tokenInput !== s.data?.message)) {
        void latestData(s).then(() => replay(s)).catch(() => undefined);
        return noChange(body.tokenInput);
      }
      if (s.phase === "ready" && (s.last === keyOf(body) || rawBody.tokenInput !== s.data?.message)) {
        if (firstConsumer || rawBody.tokenInput !== s.data?.message || s.surface?.secret !== s.data?.client_secret) replay(s);
        return noChange(body.tokenInput);
      }
      // The mounting form may still contain the previous token. Mutations use the current server token.
      body = { ...body, tokenInput: s.data?.message ?? body.tokenInput };
      s.updateBody = { ...body };
    }
    const reconcile = s.phase === "error";
    const pending = prepare(s, reconcile ? `${s.apiUrl}/api/stripe.processinitialpayment` : input,
      init, reconcile ? effectiveBody(s, { ...s.updateBody, tokenInput: undefined }) : body, process || reconcile);
    if (process) {
      void pending.catch(() => undefined);
      try {
        const data = await latestData(s);
        return json(data);
      } catch { return json({ message: "No pudimos preparar el pago." }, 409); }
    }
    const op = s.operation;
    try {
      const data = await pending;
      return current(s, op!) ? json(data) : noChange(body.tokenInput);
    } catch {
      // Never feed obsolete errors back into the IIFE's onError.
      return noChange(body.tokenInput);
    }
  }) as typeof fetch;
}
export function resetStripeSessionFetchGuardForTests(): void {
  for (const s of [...state.widgets]) dispose(s);
  if (state.installed && state.orig) window.fetch = state.orig;
  window.removeEventListener("buq__discount_added", onDiscount, true);
  state.restoreSurface?.(); state.restoreSurface = undefined;
  state.installed = false; state.widgets.clear(); state.tokens.clear(); state.fallback.clear(); state.secrets.clear();
}
export function afterStrictModePass(run: () => void): () => void {
  const id = window.setTimeout(run, 0); return () => window.clearTimeout(id);
}
