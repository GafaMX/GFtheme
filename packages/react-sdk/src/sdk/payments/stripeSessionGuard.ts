/**
 * El IIFE de `<stripe-payment-element>` hace `jsx(CheckoutProvider, …, clientSecret)`:
 * la key es el secret. Un `updateinitialpayment` con un secret distinto
 * remonta el form (`vw`), y `useEffect(() => update(), [recurringPayment])`
 * vuelve a pegarle al backend.
 *
 * El mock de apipay no devolvía secret en el update; Stripe real sí.
 * Interceptamos fetch para suprimir POSTs idénticos durante una ventana corta.
 * Las respuestas reales se conservan intactas: el token de compra puede seguir
 * igual aunque cambie la sesión Stripe y su client_secret.
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

export const STRIPE_UPDATE_DEBOUNCE_MS = DEBOUNCE_MS;

export function installStripeSessionFetchGuard(): void {
  if (state.installed || typeof window === "undefined" || typeof fetch !== "function") return;
  state.orig = fetch.bind(window);
  state.installed = true;

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const method = (init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "POST") return state.orig(input, init);

    if (UPDATE_PATH.test(url)) {
      const body = readBody(init);
      const token = tokenFromBody(body);
      const key = `${token}::${body}`;
      const now = Date.now();
      const prev = state.last.get(key);
      if (prev && now - prev.at < DEBOUNCE_MS) {
        return jsonResponse({
          message: token || prev.token || "No hubo cambios",
        });
      }
      const response = await state.orig(input, init);
      if (response.ok) state.last.set(key, { at: Date.now(), body, token });
      return response;
    }

    if (PROCESS_PATH.test(url)) {
      return state.orig(input, init);
    }

    return state.orig(input, init);
  }) as typeof fetch;
}

/** Tests. */
export function resetStripeSessionFetchGuardForTests(): void {
  if (state.installed && typeof window !== "undefined") {
    window.fetch = state.orig;
  }
  state.installed = false;
  state.last.clear();
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
