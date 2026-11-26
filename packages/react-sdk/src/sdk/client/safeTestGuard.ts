/**
 * Modo prueba de matrícula: allowlist HTTP de lecturas + login.
 * Cualquier POST/PUT/PATCH/DELETE que no sea `/oauth/token`, y cualquier
 * host de cobro (GafaPay/Stripe/frontpay) o Hub, se corta ANTES de fetch.
 */

export const SAFE_TEST_BLOCKED_MESSAGE = "bloqueado en modo prueba";
export const SAFE_TEST_BLOCKED_EVENT = "gafa-sdk:safe-test-blocked";

export class SafeTestBlockedError extends Error {
  readonly method: string;
  readonly url: string;
  readonly reason?: string;

  constructor(method: string, url: string, reason?: string) {
    super(SAFE_TEST_BLOCKED_MESSAGE);
    this.name = "SafeTestBlockedError";
    this.method = method;
    this.url = url;
    this.reason = reason;
  }
}

export type SafeTestVerdict = { ok: true } | { ok: false; reason: string };

const WRITE_PATH =
  /reservate|initial-purchase|generate|\/cancel|waitlist\/remove|\/register|\/password|oauth\/revoke|\/logout/i;

function hostOf(url: string): { host: string; path: string } {
  const parsed = new URL(url, "https://buq.partners");
  return { host: parsed.hostname.toLowerCase(), path: parsed.pathname };
}

export function evaluateSafeTestRequest(method: string, url: string): SafeTestVerdict {
  const verb = method.trim().toUpperCase() || "GET";
  const { host, path } = hostOf(url);

  if (
    host.includes("stripe") ||
    host.includes("gafapay") ||
    host === "frontpay.buq.partners" ||
    host.endsWith(".stripe.com")
  ) {
    return { ok: false, reason: "host de cobro" };
  }
  if (host === "hub.buq.partners" || host.startsWith("hub.")) {
    return { ok: false, reason: "hub" };
  }
  if (host !== "buq.partners") {
    return { ok: false, reason: `host no allowlist (${host})` };
  }

  if (verb === "GET" || verb === "HEAD") {
    if (WRITE_PATH.test(path)) return { ok: false, reason: "GET de escritura" };
    return { ok: true };
  }

  if (verb === "POST" && (path === "/oauth/token" || path.endsWith("/oauth/token"))) {
    return { ok: true };
  }

  return { ok: false, reason: `${verb} ${path}` };
}

export function assertSafeTestRequest(method: string, url: string): void {
  const verdict = evaluateSafeTestRequest(method, url);
  if (verdict.ok) return;
  emitSafeTestBlocked(method, url, verdict.reason);
  throw new SafeTestBlockedError(method, url, verdict.reason);
}

export function emitSafeTestBlocked(method: string, url: string, reason?: string): void {
  if (typeof window === "undefined") return;
  let path = url;
  try {
    path = new URL(url, "https://buq.partners").pathname;
  } catch {
    /* url cruda */
  }
  window.dispatchEvent(
    new CustomEvent(SAFE_TEST_BLOCKED_EVENT, {
      detail: { method: method.toUpperCase(), url: path, reason: reason ?? "bloqueado" },
    }),
  );
}

export function subscribeSafeTestBlocked(
  listener: (detail: { method: string; url: string; reason: string }) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail as { method: string; url: string; reason: string };
    listener(detail);
  };
  window.addEventListener(SAFE_TEST_BLOCKED_EVENT, handler);
  return () => window.removeEventListener(SAFE_TEST_BLOCKED_EVENT, handler);
}
