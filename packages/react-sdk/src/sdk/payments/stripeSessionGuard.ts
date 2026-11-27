/** Checkout state machine. The IIFE is a consumer, never the owner of readiness. */
import { installStripeSurfaceTracking } from "./stripeSurface";

const UPDATE_PATH = /\/api\/stripe\.updateinitialpayment(?:\?|$)/i;
const PROCESS_PATH = /\/api\/stripe\.processinitialpayment(?:\?|$)/i;
const COMPLETE_PATH = /\/api\/stripe\.completeinitialpayment(?:\?|$)/i;
export const STRIPE_SESSION_PROGRESS_EVENT = "gafa-stripe-session-progress";
export const STRIPE_UPDATE_DEBOUNCE_MS = 2000;
export const STRIPE_PREPARATION_TIMEOUT_MS = 30_000;
export const STRIPE_COMPLETE_TIMEOUT_MS = 30_000;

type PaymentData = { message?: string; client_secret?: string; [key: string]: unknown };
export type StripePreparationContext = { revision: number; signal: AbortSignal; isCurrent?: () => boolean };
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
  transport?: AbortController;
  completeAuthorized?: boolean;
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
type MutationLane = { tail: Promise<unknown>; uncertain: boolean; quarantined: Set<string> };
// Survives DOM generations. Only disposal or a transport deadline can end the wait for an in-flight write.
const lanes = new WeakMap<StripeCheckoutState, MutationLane>();
function laneFor(checkout: StripeCheckoutState): MutationLane {
  let lane = lanes.get(checkout);
  if (!lane) { lane = { tail: Promise.resolve(), uncertain: false, quarantined: new Set() }; lanes.set(checkout, lane); }
  return lane;
}
async function mutation<T>(s: WidgetSession, op: Operation, run: (signal: AbortSignal) => Promise<T>,
  timeoutMs = STRIPE_PREPARATION_TIMEOUT_MS, requestToken?: unknown): Promise<T> {
  const lane = laneFor(s.checkout);
  const pending = lane.tail.then(async () => {
    if (!current(s, op)) throw abortError();
    progress(s, op);
    if (!current(s, op)) throw abortError();
    const token = s.data?.message;
    const transport = s.transport = new AbortController();
    const timer = setTimeout(() => transport.abort(new Error("La escritura de pago no respondió a tiempo. Reintenta con una sesión nueva.")), timeoutMs);
    try {
      return await withStripeAbort(Promise.resolve().then(() => {
        if (transport.signal.aborted) throw transport.signal.reason;
        return run(transport.signal);
      }), transport.signal);
    } catch (error) {
      lane.uncertain = true;
      if (token) lane.quarantined.add(token);
      if (typeof requestToken === "string" && requestToken) lane.quarantined.add(requestToken);
      throw error;
    }
    finally { clearTimeout(timer); s.transport = undefined; }
  });
  lane.tail = pending.catch(() => undefined);
  return withStripeAbort(pending, op.signal);
}
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
    s.surface.node.querySelector("iframe")) && s.last === keyOf(sessionUpdateBody(s));
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
  if (s.phase !== "confirming") op.timer = setTimeout(() => fail(s, op, new Error("Stripe no respondió a tiempo. Intenta de nuevo.")), STRIPE_PREPARATION_TIMEOUT_MS);
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
  s.transport?.abort(abortError());
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
}): { dispose: () => void; update: (body: Record<string, unknown>) => void; onEvent: (data: unknown, created: boolean) => void } {
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
    update: (body) => {
      if (!active(s)) return;
      const changedBody = keyOf(s.updateBody) !== keyOf(body);
      s.updateBody = body;
      if (changedBody) changed(s);
    },
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
    if (previous && previous.provider !== provider) previous.destroy();
    changed(s); return true;
  },
  ready(secret: string, node: Element, provider: object) {
    const s = [...state.widgets].find((session) => session.surface?.node === node && session.surface.secret === secret && session.surface.provider === provider);
    if (s?.surface) { s.surface.ready = true; changed(s); }
  },
  unmount(secret: string, node: Element, provider: object) {
    const s = [...state.widgets].find((session) => session.surface?.node === node && session.surface.secret === secret && session.surface.provider === provider);
    if (s) { s.surface = undefined; changed(s); }
  },
  canConfirm(secret: string, provider: object) {
    const s = providerOwners.get(provider);
    if (!s || !active(s) || confirmations.has(s.checkout) || s.phase !== "confirming" || !s.completeAuthorized ||
        s.data?.client_secret !== secret || s.surface?.provider !== provider || !surfaceReady(s)) return false;
    // Stripe.confirm itself cannot be aborted. Freeze further mutations until it settles.
    s.completeAuthorized = false;
    confirmations.set(s.checkout, provider);
    return true;
  },
  confirmed(secret: string, success: boolean | undefined, provider: object) {
    const s = providerOwners.get(provider);
    if (!s || confirmations.get(s.checkout) !== provider) return;
    if (success === undefined) {
      // Transport failure after Stripe.confirm is ambiguous: keep the charge
      // barrier until the host reconciles the purchase, including across remounts.
      if (active(s)) { s.phase = "error"; changed(s); }
      return;
    }
    confirmations.delete(s.checkout);
    if (active(s) && s.phase === "confirming" && s.data?.client_secret === secret && s.surface?.provider === provider) {
      s.phase = success ? "done" : "ready"; changed(s);
    }
  },
};

function findWidget(url: string, body: Record<string, unknown>, process: boolean): WidgetSession | null | undefined {
  const inScope = (s: WidgetSession) => url.startsWith(`${s.apiUrl}/api/stripe.`);
  if (!process && typeof body.tokenInput === "string" && state.tokens.has(body.tokenInput)) {
    const owner = state.tokens.get(body.tokenInput);
    return owner && inScope(owner) ? owner : null;
  }
  const matches = [...state.widgets].filter((s) => active(s) && inScope(s) &&
    (body.customer_email ?? "") === (s.updateBody.customer_email ?? ""));
  if (matches.length <= 1) return matches[0];
  const scoped = matches.filter((s) => ["companiesId", "locationsId", "usersProfilesId", "usersId"].every(
    (key) => body[key] == null || body[key] === s.updateBody[key],
  ));
  // The IIFE supplies no element identity on bootstrap. Ambiguous ownership must fail closed.
  return scoped.length === 1 ? scoped[0] : null;
}
function effectiveBody(s: WidgetSession, body: Record<string, unknown>) {
  const frequency = Number(s.updateBody.paymentFrequency);
  const recurring = s.updateBody.recurringPayment === true && s.checkout.recurringPayment !== false &&
    Number.isInteger(frequency) && frequency > 0;
  return { ...body, saveCard: s.checkout.saveCard ?? false, recurringPayment: recurring,
    paymentFrequency: recurring ? frequency : null };
}
function sessionUpdateBody(s: WidgetSession, token = s.data?.message) {
  return effectiveBody(s, { ...s.updateBody, tokenInput: token });
}
async function prepare(s: WidgetSession, input: RequestInfo | URL, init: RequestInit,
  body: Record<string, unknown>, process: boolean, seed?: PaymentData): Promise<PaymentData> {
  s.operation?.controller.abort(abortError());
  clearTimeout(s.operation?.timer);
  const controller = new AbortController();
  const op: Operation = { revision: s.checkout.revision = (s.checkout.revision ?? 0) + 1,
    signal: controller.signal, controller, promise: Promise.resolve({}) };
  s.operation = op; s.revision = op.revision; s.phase = "preparing"; s.last = undefined; s.completeAuthorized = false;
  if (seed) s.data = seed;
  progress(s, op);
  const lane = laneFor(s.checkout);
  const run = async () => {
    // A superseded transport may still write. Wait for it, then recover with a
    // fresh process/token if its outcome was indeterminate (including timeout).
    await withStripeAbort(lane.tail, op.signal);
    if (!current(s, op)) throw abortError();
    if (lane.uncertain) {
      process = true; seed = undefined;
      input = `${s.apiUrl}/api/stripe.processinitialpayment`;
      body = effectiveBody(s, { ...s.updateBody, tokenInput: undefined });
    }
    const sent = new Set<string>();
    const send = async (url: RequestInfo | URL, payload: Record<string, unknown>) => {
      const data = await mutation(s, op, async (signal) => {
        const update = UPDATE_PATH.test(urlOf(url));
        const currentBody = effectiveBody(s, update
          ? { ...s.updateBody, tokenInput: payload.tokenInput }
          : { ...payload, lineItems: s.updateBody.lineItems });
        if (update) sent.add(keyOf(currentBody));
        const response = await state.orig!(url, { ...init, signal, body: JSON.stringify(currentBody) });
        if (!response.ok) throw new Error("No pudimos preparar la sesión de Stripe.");
        return response.clone().json() as Promise<PaymentData>;
      }, STRIPE_PREPARATION_TIMEOUT_MS, payload.tokenInput);
      if (!current(s, op)) throw abortError();
      progress(s, op); return data;
    };
    const updateUrl = `${s.apiUrl}/api/stripe.updateinitialpayment`;
    let data = seed ?? await send(input, body);
    let created = process && !seed;
    while (current(s, op)) {
      if (!data.client_secret || !data.message) throw new Error("Stripe no devolvió una sesión de pago válida.");
      if (lane.quarantined.has(data.message)) {
        throw new Error("La sesión anterior no está reconciliada. Se necesita una orden de pago nueva.");
      }
      if (created) lane.uncertain = false;
      s.data = data;
      state.secrets.add(data.client_secret);
      if (data.message) state.tokens.set(data.message, s);
      await mutation(s, op, async (signal) => s.onInitialPayment({
        ...data, subscriptionId: sessionUpdateBody(s).recurringPayment ? data.subscriptionId : null,
      }, created, { revision: op.revision, signal, isCurrent: () => current(s, op) }));
      if (!current(s, op)) throw abortError();
      progress(s, op);
      const nextBody = sessionUpdateBody(s, data.message);
      const key = keyOf(nextBody);
      s.last = key;
      if (sent.has(key)) break;
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
  const body = sessionUpdateBody(s, d.checkout_token);
  void prepare(s, `${s.apiUrl}/api/stripe.updateinitialpayment`, {
    ...s.requestInit, method: "POST",
  }, body, false, { message: d.checkout_token, client_secret: d.client_secret })
    .then(() => replay(s)).catch(() => undefined);
}
/** Re-register explicit modal preferences through the same revision and write barrier. */
export function refreshStripeCheckout(checkout: StripeCheckoutState): void {
  const s = owners.get(checkout);
  if (!s || !active(s) || !s.data || confirmations.has(checkout) || ["confirming", "done"].includes(s.phase)) return;
  const body = sessionUpdateBody(s);
  void prepare(s, `${s.apiUrl}/api/stripe.updateinitialpayment`, { ...s.requestInit, method: "POST" }, body, false, s.data)
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
    if (s === null) return json({ message: "No pudimos identificar la sesión de pago." }, 409);
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
    if (!complete && s.phase === "confirming") return json({ message: "El pago ya está en curso." }, 409);
    // Explicit modal opt-in AND opt-out take precedence over the IIFE's local default.
    if (body.saveCard === true && s.checkout.saveCard !== false) s.checkout.saveCard = true;
    if (complete) {
      if (s.phase !== "ready" || !surfaceReady(s) || body.tokenInput !== s.data?.message) return json({ message: "El formulario de pago todavía no está listo." }, 409);
      const op = s.operation!;
      const revision = s.revision;
      s.completeAuthorized = false;
      s.phase = "confirming"; changed(s);
      try {
        // Own deadline; readiness cancelled the preparation timer. Include body
        // consumption so a hung response stream cannot strand confirmation either.
        const response = await mutation(s, op, async (signal) => {
          const payload = effectiveBody(s, "lineItems" in body ? { ...body, lineItems: s.updateBody.lineItems } : body);
          const response = await state.orig!(input, { ...init, signal, body: JSON.stringify(payload) });
          const data = await response.text();
          if (response.ok) {
            let result;
            try { result = JSON.parse(data); } catch { /* The response body can contain arbitrary data. */ }
            if (typeof result?.message !== "string" || !result.message.trim()) {
              throw new Error("Stripe no devolvió una confirmación de preparación válida.");
            }
          }
          return new Response(data, { status: response.status, headers: response.headers });
        }, STRIPE_COMPLETE_TIMEOUT_MS);
        clearTimeout(op.timer);
        if (!active(s) || s.revision !== revision || s.phase !== "confirming") return json({ message: "La sesión de pago cambió." }, 409);
        if (!surfaceReady(s)) {
          const message = "El formulario de pago cambió. Reintenta con una sesión nueva.";
          fail(s, op, new Error(message));
          return json({ message }, 409);
        }
        if (response.ok) s.completeAuthorized = true;
        else fail(s, op, new Error("No pudimos completar la preparación del pago. Reintenta con una sesión nueva."));
        return response;
      } catch (error) { if (s.revision === revision && active(s)) fail(s, op, error); throw error; }
    }
    if (update) {
      const token = body.tokenInput;
      const currentToken = s.data?.message;
      const currentBody = { ...sessionUpdateBody(s), tokenInput: currentToken ?? token };
      // vw installs its discount listener before its mount update effect.
      const firstConsumer = !s.consumer;
      s.consumer = true;
      if (s.phase === "preparing" && (firstConsumer || token !== currentToken)) {
        void latestData(s).then(() => replay(s)).catch(() => undefined);
        return noChange(token);
      }
      if (s.phase === "ready" && (s.last === keyOf(currentBody) || token !== currentToken)) {
        if (firstConsumer || token !== currentToken || s.surface?.secret !== s.data?.client_secret) replay(s);
        return noChange(token);
      }
      // The mounting form may still contain the previous token. Mutations use the current server token.
      body = currentBody;
    }
    s.requestInit = init;
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
