import type { GafaClient, InitialPurchasePayload, InitialPurchaseResult } from "../client/types";

const POLL_MS = 2_000;
const POLL_ATTEMPTS = 90;

export function checkoutTokenFromHostedData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  for (const value of [rec.checkout_token, rec.checkoutToken, rec.token, rec.id]) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  const redirect = rec.redirect;
  if (typeof redirect === "string") {
    try {
      const url = new URL(redirect, "https://app.recurrente.com");
      const fromQuery =
        url.searchParams.get("checkout_token") ?? url.searchParams.get("checkoutToken");
      if (fromQuery) return fromQuery;
    } catch {
      // URL relativa rara: cae al regex
    }
    const session = redirect.match(/checkout-session\/([^/?#]+)/i);
    if (session?.[1]) return decodeURIComponent(session[1]);
  }
  return null;
}

export class HostedCheckoutClosedError extends Error {
  constructor() {
    super("HOSTED_CHECKOUT_CLOSED");
    this.name = "HostedCheckoutClosedError";
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new HostedCheckoutClosedError();
}

function whenAborted(signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return;
    if (signal.aborted) {
      reject(new HostedCheckoutClosedError());
      return;
    }
    signal.addEventListener("abort", () => reject(new HostedCheckoutClosedError()), { once: true });
  });
}

export async function pollRecurrenteUntilDone(options: {
  client: GafaClient;
  brandSlug: string;
  locationSlug: string;
  checkoutToken: string;
  pendingPurchaseId: number;
  poll?: (ms: number) => Promise<void>;
  attempts?: number;
  signal?: AbortSignal;
}): Promise<{ reservationId?: number; raw?: unknown }> {
  const wait = options.poll ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const attempts = options.attempts ?? POLL_ATTEMPTS;
  const cancel = whenAborted(options.signal);

  for (let i = 0; i < attempts; i += 1) {
    throwIfAborted(options.signal);
    const status = await Promise.race([
      options.client.pollInitialPurchaseStatus!({
        brandSlug: options.brandSlug,
        locationSlug: options.locationSlug,
        checkoutToken: options.checkoutToken,
        pendingPurchaseId: options.pendingPurchaseId,
      }),
      cancel,
    ]);
    if (status.code === 1) {
      return { reservationId: status.reservationId, raw: status.raw };
    }
    if (status.code === -1) {
      throw new Error(status.message || "No se pudo completar el pago.");
    }
    throwIfAborted(options.signal);
    await Promise.race([wait(POLL_MS), cancel]);
  }

  throw new Error("El pago sigue pendiente. Si ya pagaste, pulsa «Revisar pago».");
}

/**
 * GafaPay abre el checkout alojado con `window.open`. Si el socio cierra esa
 * ventana (o el navegador la bloquea), el CTA no puede quedarse en “Esperando…”.
 */
export function watchNextPopup(
  onClose: () => void,
  options?: { missMs?: number; onMiss?: () => void },
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const original = window.open.bind(window);
  let interval = 0;
  let missTimer = 0;
  let finished = false;
  let opened = false;

  const finish = (missed = false) => {
    if (finished) return;
    finished = true;
    if (interval) window.clearInterval(interval);
    if (missTimer) window.clearTimeout(missTimer);
    window.open = original;
    if (missed) options?.onMiss?.();
    else onClose();
  };

  window.open = ((...args: Parameters<Window["open"]>) => {
    opened = true;
    if (missTimer) {
      window.clearTimeout(missTimer);
      missTimer = 0;
    }
    const popup = original(...args);
    if (!popup || popup.closed) {
      finish();
      return popup;
    }
    interval = window.setInterval(() => {
      if (popup.closed) finish();
    }, 350);
    return popup;
  }) as typeof window.open;

  if (options?.missMs && options.onMiss) {
    missTimer = window.setTimeout(() => {
      if (!opened) finish(true);
    }, options.missMs);
  }

  return () => {
    window.open = original;
    if (interval) window.clearInterval(interval);
    if (missTimer) window.clearTimeout(missTimer);
    finished = true;
  };
}

export async function completeRecurrentePurchase(options: {
  client: GafaClient;
  payload: InitialPurchasePayload;
  checkoutToken: string;
  poll?: (ms: number) => Promise<void>;
  attempts?: number;
}): Promise<InitialPurchaseResult> {
  const { client, payload, checkoutToken } = options;
  if (!client.initialPurchase || !client.pollInitialPurchaseStatus) {
    throw new Error("Esta marca no tiene configurado el pago con tarjeta.");
  }

  const pending = await client.initialPurchase({
    ...payload,
    checkoutToken,
    paymentData: payload.paymentData ?? { checkout_token: checkoutToken },
  });

  const token = pending.checkoutToken?.trim() || checkoutToken;
  const purchaseId = pending.purchaseId;
  if (purchaseId == null) {
    throw new Error("No se pudo crear la compra pendiente.");
  }

  const done = await pollRecurrenteUntilDone({
    client,
    brandSlug: payload.brandSlug,
    locationSlug: payload.locationSlug,
    checkoutToken: token,
    pendingPurchaseId: purchaseId,
    poll: options.poll,
    attempts: options.attempts,
  });

  return {
    purchaseId,
    checkoutToken: token,
    reservationId: done.reservationId ?? pending.reservationId,
    raw: done.raw,
  };
}
