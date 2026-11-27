/**
 * Correlate the IIFE's HTTP requests with the mounted checkout. Its DOM events
 * carry no request identity and it only emits `updated` when a secret is present.
 * A successful response is acknowledged here even when the secret is omitted.
 */
const UPDATE_PATH = /\/api\/stripe\.updateinitialpayment(?:\?|$)/i;
const PROCESS_PATH = /\/api\/stripe\.processinitialpayment(?:\?|$)/i;
const DEBOUNCE_MS = 2000;

type GuardState = {
  orig: typeof fetch;
  last: Map<string, { at: number; body: string; token: string }>;
  installed: boolean;
};

const state: GuardState = {
  orig: typeof fetch === "function" ? fetch.bind(globalThis) : (fetch as typeof fetch),
  last: new Map(),
  installed: false,
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

function readBody(init?: RequestInit): string {
  if (!init?.body) return "";
  return typeof init.body === "string" ? init.body : "";
}

function tokenFromBody(body: string): string {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as { tokenInput?: unknown };
    return typeof parsed.tokenInput === "string" ? parsed.tokenInput : "";
  } catch {
    return "";
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function correlatedResponse(data: unknown, status: number, current: () => boolean): Response {
  const response = jsonResponse(data, status);
  const parse = response.json.bind(response);
  response.json = async () => {
    const value = await parse();
    // The IIFE consumes json() after fetch resolves; a choice or unmount can
    // intervene between those two awaits as well as during the network call.
    return current() ? value : {};
  };
  return response;
}

export const STRIPE_UPDATE_DEBOUNCE_MS = DEBOUNCE_MS;

type Session = {
  element: Element;
  active: boolean;
  version: number;
  desired?: boolean;
  token?: string;
  secret?: string;
  confirmed?: boolean;
  confirmedVersion?: number;
  initialized: boolean;
  failed: boolean;
  pending: number;
  sequence: number;
  latest: number;
  lastUpdate?: { body: string; version: number };
  lastRequest?: { input: RequestInfo | URL; init?: RequestInit; body: string };
  tail: Promise<unknown>;
  listeners: Set<() => void>;
};
const sessions = new Map<Element, Session>();
const tokens = new Map<string, Session>();

function notify(session: Session) {
  for (const listener of session.listeners) listener();
  if (session.secret) session.element.dispatchEvent(new Event("gafa-stripe-session", { bubbles: true }));
}

/** Register before connectedCallback can start OAuth/processinitialpayment. */
export function registerStripeSession(element: Element): () => void {
  const session: Session = {
    element, active: true, version: 0, desired: false, initialized: false, failed: false,
    pending: 0, sequence: 0, latest: 0, tail: Promise.resolve(), listeners: new Set(),
  };
  sessions.set(element, session);
  return () => {
    session.active = false;
    sessions.delete(element);
    notify(session);
    // Keep retired token ownership so late requests cannot enter a new attempt.
  };
}

export function hasStripeSession(element: Element): boolean {
  return sessions.has(element);
}

export function chooseStripeRecurrence(element: Element, checked: boolean): void {
  const session = sessions.get(element);
  if (!session || session.desired === checked) return;
  session.desired = checked;
  session.version++;
  notify(session);
}

export function stripeRecurrenceConfirmed(element: Element, checked: boolean): boolean {
  const session = sessions.get(element);
  return Boolean(session?.active && !session.failed && session.initialized && !session.pending
    && session.secret && session.confirmedVersion === session.version && session.confirmed === checked
    && (session.desired === undefined || session.desired === checked));
}

export function stripeSessionSequence(element: Element): number {
  return sessions.get(element)?.sequence ?? 0;
}

/** Drain ALL earlier requests, including initial updates without `updating`. */
export function waitForStripeSession(element: Element, afterSequence = -1): Promise<boolean> {
  const session = sessions.get(element);
  if (!session) return Promise.resolve(false);
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      session.listeners.delete(check);
      resolve(ok);
    };
    const check = () => {
      if (!session.active || session.failed) finish(false);
      else if (session.initialized && session.pending === 0
        && (session.sequence > afterSequence || (session.confirmedVersion === session.version
          && session.confirmed === session.desired))) finish(true);
    };
    const timer = setTimeout(() => { session.failed = true; notify(session); }, 15_000);
    session.listeners.add(check);
    check();
  });
}

/** Revalidate a choice that returned to the same provider checkbox value while
 * an older version was pending. React would otherwise skip its unchanged effect.
 */
export async function refreshStripeSession(element: Element): Promise<boolean> {
  const session = sessions.get(element);
  if (!session?.active || !session.lastRequest || processOwner() !== session) return false;
  const version = session.version;
  const { input, init, body } = session.lastRequest;
  const response = await fetch(input, { ...init, body: JSON.stringify({ ...JSON.parse(body), tokenInput: session.token, recurringPayment: session.desired }) });
  const data = await response.json();
  if (!session.active || version !== session.version || !stripeRecurrenceConfirmed(element, session.desired!)) return false;
  // The IIFE exposes this session replacement hook on window. Only use it for
  // the sole active mounted attempt, after checking its version again.
  if (data.client_secret) window.dispatchEvent(new CustomEvent("buq__discount_added", { detail: {
    client_secret: data.client_secret, checkout_token: session.token,
  } }));
  return true;
}

function processOwner(): Session | undefined {
  // The provider has a singleton API client. Multiple mounted checkouts are
  // ambiguous: never attribute their responses to an arbitrary checkout.
  const active = [...sessions.values()].filter((session) => session.active);
  return active.length === 1 ? active[0] : undefined;
}

export function installStripeSessionFetchGuard(): void {
  if (state.installed || typeof window === "undefined" || typeof fetch !== "function") return;
  state.orig = fetch.bind(window);
  state.installed = true;

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const method = (init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "POST") return state.orig(input, init);
    const process = PROCESS_PATH.test(url);
    const update = UPDATE_PATH.test(url);
    const complete = /\/api\/stripe\.completeinitialpayment(?:\?|$)/i.test(url);
    if (!process && !update && !complete) return state.orig(input, init);
    const body = readBody(init);
    const token = tokenFromBody(body);
    const session = process ? processOwner() : tokens.get(token);

    if (session) {
      const requested = process ? false : (JSON.parse(body) as { recurringPayment?: boolean }).recurringPayment;
      if (!session.active || (!process && token !== session.token)) {
        if (complete) throw new Error("La sesión de pago ya no está vigente.");
        return jsonResponse({});
      }
      if (update) session.lastRequest = { input, init, body };
      if (complete) {
        // Recheck after the SDK preflight's asynchronous work, immediately
        // before completeinitialpayment and the IIFE's checkout.confirm().
        if (typeof requested !== "boolean" || !stripeRecurrenceConfirmed(session.element, requested)) {
          throw new Error("La elección recurrente cambió antes de confirmar el pago.");
        }
        const version = session.version;
        const response = await state.orig(input, init);
        const parse = response.json.bind(response);
        response.json = async () => {
          const data = await parse();
          if (!session.active || version !== session.version || token !== session.token
            || !stripeRecurrenceConfirmed(session.element, requested)) {
            throw new Error("La sesión de pago cambió durante la confirmación.");
          }
          return data;
        };
        return response;
      }
      // CheckoutProvider remounts when a response genuinely rotates its secret.
      // Its new form repeats the exact update. Reuse only this attempt/version's
      // completed confirmation so rotation cannot create an update/remount loop.
      if (update && !session.pending && !session.failed && session.lastUpdate?.body === body
        && session.lastUpdate.version === session.version && session.confirmed === requested
        && session.confirmedVersion === session.version) return jsonResponse({ message: session.token });
      const version = session.version;
      const id = ++session.sequence;
      session.latest = id;
      session.pending++;
      notify(session);
      const run = async () => {
        try {
          if (!session.active || session.failed) return jsonResponse({});
          const response = await state.orig(input, init);
          if (!response.ok) { session.failed = true; return response; }
          const data = await response.clone().json() as Record<string, unknown>;
          // A response may mutate the IIFE only for its original mounted
          // attempt and choice. Stale process responses must not create a form.
          if (!session.active || session.failed) return jsonResponse({});
          if (process) {
            if (id !== session.latest) return jsonResponse({});
            if (typeof data.message !== "string" || typeof data.client_secret !== "string") {
              session.failed = true;
              return jsonResponse({});
            }
            session.token = data.message;
            session.secret = data.client_secret;
            tokens.set(data.message, session);
            // Initialization always starts non-recurring in the real IIFE.
            // Wait for its first update before claiming the session is ready.
            return correlatedResponse(data, response.status, () => session.active && id === session.latest);
          }
          session.initialized = true;
          if (version !== session.version || id !== session.latest
            || (session.desired !== undefined && requested !== session.desired)) {
            session.confirmed = undefined;
            return jsonResponse({});
          }
          const changedToken = typeof data.message === "string" && data.message !== token;
          const secret = typeof data.client_secret === "string" && data.client_secret ? data.client_secret : undefined;
          // An unchanged single-payment session can keep its existing secret.
          // A recurrence change requires the actual matching response secret.
          if (!secret && (changedToken || requested !== false || session.element.getAttribute("has-recurring-payment") !== "false")) {
            session.failed = true;
            return jsonResponse({});
          }
          if (changedToken) {
            session.token = data.message as string;
            tokens.set(session.token, session);
          }
          if (secret) session.secret = secret;
          session.confirmed = requested;
          session.confirmedVersion = version;
          session.lastUpdate = { body, version };
          session.element.dispatchEvent(new CustomEvent("gafa-stripe-payment-updated", { bubbles: true, detail: {
            ...data, message: session.token, client_secret: session.secret,
            subscriptionId: requested ? data.subscriptionId : null,
          } }));
          // Identical secrets do not change React's CheckoutProvider key. A
          // genuinely new secret must reach the IIFE so confirm uses that one.
          return correlatedResponse(data, response.status, () => session.active && id === session.latest
            && version === session.version && (session.desired === undefined || session.desired === requested));
        } catch (error) {
          session.failed = true;
          throw error;
        } finally {
          session.pending--;
          notify(session);
        }
      };
      // Updates must reach the server in order too; ignoring an old response
      // alone cannot prevent an old request from restoring recurrence there.
      const result = session.tail.then(run, run);
      session.tail = result.catch(() => undefined);
      return result;
    }
    // Registered checkouts never accept unowned session responses, including
    // updates from an unmounted IIFE and ambiguous simultaneous mounts.
    if (sessions.size) {
      if (complete) throw new Error("No se pudo identificar la sesión de pago.");
      return jsonResponse({});
    }
    if (process || complete) return state.orig(input, init);

    // Preserve the standalone guard contract for non-SDK consumers.
    const key = `${url}::${token}`;
    const prev = state.last.get(key);
    if (token && prev?.body === body && Date.now() - prev.at < DEBOUNCE_MS) return jsonResponse({ message: token });
    state.last.delete(key);
    const response = await state.orig(input, init);
    if (!response.ok) return response;
    const data = await response.clone().json().catch(() => null);
    if (!data || typeof data !== "object") return response;
    const next = { ...data };
    const changed = typeof next.message === "string" && token !== "" && next.message !== token;
    if (!changed) delete next.client_secret;
    if (token && !changed && !/"recurringPayment"\s*:/.test(body)) state.last.set(key, { at: Date.now(), body, token });
    return jsonResponse(next, response.status);
  }) as typeof fetch;
}

/** Tests. */
export function resetStripeSessionFetchGuardForTests(): void {
  if (state.installed && typeof window !== "undefined") {
    window.fetch = state.orig;
  }
  state.installed = false;
  state.last.clear();
  for (const session of sessions.values()) { session.active = false; notify(session); }
  sessions.clear();
  tokens.clear();
}

/**
 * StrictMode monta→cleanup→monta en el mismo tick. Si el mount del widget
 * corre en el primer effect, el cleanup lo tira y el segundo crea OTRA orden.
 * Diferimos al timeout 0: el primer run se cancela y solo queda uno.
 */
export function afterStrictModePass(run: () => void): () => void {
  const id = window.setTimeout(run, 0);
  return () => window.clearTimeout(id);
}
