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

export async function pollRecurrenteUntilDone(options: {
  client: GafaClient;
  brandSlug: string;
  locationSlug: string;
  checkoutToken: string;
  pendingPurchaseId: number;
  poll?: (ms: number) => Promise<void>;
  attempts?: number;
}): Promise<{ reservationId?: number; raw?: unknown }> {
  const wait = options.poll ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const attempts = options.attempts ?? POLL_ATTEMPTS;

  for (let i = 0; i < attempts; i += 1) {
    const status = await options.client.pollInitialPurchaseStatus!({
      brandSlug: options.brandSlug,
      locationSlug: options.locationSlug,
      checkoutToken: options.checkoutToken,
      pendingPurchaseId: options.pendingPurchaseId,
    });
    if (status.code === 1) {
      return { reservationId: status.reservationId, raw: status.raw };
    }
    if (status.code === -1) {
      throw new Error(status.message || "Recurrente no pudo completar el pago.");
    }
    await wait(POLL_MS);
  }

  throw new Error(
    "El pago en Recurrente sigue pendiente. Si ya pagaste, pulsa «Revisar pago» sin volver a abrir la ventana.",
  );
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
    throw new Error("Esta marca no tiene configurado el checkout de Recurrente.");
  }

  const pending = await client.initialPurchase({
    ...payload,
    checkoutToken,
    paymentData: payload.paymentData ?? { checkout_token: checkoutToken },
  });

  const token = pending.checkoutToken?.trim() || checkoutToken;
  const purchaseId = pending.purchaseId;
  if (purchaseId == null) {
    throw new Error("Buq no creó la compra pendiente de Recurrente.");
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
