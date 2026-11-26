import { describe, expect, it, vi } from "vitest";
import type { GafaClient, InitialPurchasePayload } from "../client/types";
import {
  checkoutTokenFromHostedData,
  completeRecurrentePurchase,
  HostedCheckoutClosedError,
  pollRecurrenteUntilDone,
  watchNextPopup,
} from "./recurrenteCheckout";

describe("checkoutTokenFromHostedData", () => {
  it("lee checkout_token, id o la URL de Recurrente", () => {
    expect(checkoutTokenFromHostedData({ checkout_token: "chk_1", redirect: "https://x" })).toBe("chk_1");
    expect(checkoutTokenFromHostedData({ id: "ch_abc", redirect: "https://x" })).toBe("ch_abc");
    expect(
      checkoutTokenFromHostedData({
        redirect: "https://app.recurrente.com/checkout-session/ch_from_url?foo=1",
      }),
    ).toBe("ch_from_url");
  });
});

const payload: InitialPurchasePayload = {
  brandSlug: "voltio",
  locationSlug: "avia",
  userId: 1,
  lines: [{ id: 10, type: "combo", amount: 1 }],
  paymentTypeId: 9,
};

function client(overrides: Partial<GafaClient> = {}): GafaClient {
  return {
    initialPurchase: vi.fn(async () => ({ purchaseId: 88, checkoutToken: "chk_1" })),
    pollInitialPurchaseStatus: vi.fn(async () => ({ code: 1, reservationId: 77 })),
    ...overrides,
  } as unknown as GafaClient;
}

describe("completeRecurrentePurchase", () => {
  it("crea la compra pendiente y espera a que Recurrente confirme", async () => {
    const api = client();
    const result = await completeRecurrentePurchase({
      client: api,
      payload,
      checkoutToken: "chk_1",
      poll: async () => undefined,
      attempts: 3,
    });

    expect(api.initialPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ checkoutToken: "chk_1", paymentTypeId: 9 }),
    );
    expect(api.pollInitialPurchaseStatus).toHaveBeenCalledWith(
      expect.objectContaining({ checkoutToken: "chk_1", pendingPurchaseId: 88 }),
    );
    expect(result).toEqual(
      expect.objectContaining({ purchaseId: 88, reservationId: 77, checkoutToken: "chk_1" }),
    );
  });

  it("reintenta mientras el status es 0 y falla con -1", async () => {
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ code: 0 })
      .mockResolvedValueOnce({ code: -1, message: "Pago cancelado" });
    const api = client({ pollInitialPurchaseStatus: poll });

    await expect(
      completeRecurrentePurchase({
        client: api,
        payload,
        checkoutToken: "chk_1",
        poll: async () => undefined,
        attempts: 5,
      }),
    ).rejects.toThrow(/pago cancelado/i);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("corta el poll si se aborta (cerraron la ventana de pago)", async () => {
    const abort = new AbortController();
    const poll = vi.fn(async () => {
      abort.abort();
      return { code: 0 };
    });
    await expect(
      pollRecurrenteUntilDone({
        client: client({ pollInitialPurchaseStatus: poll }),
        brandSlug: "voltio",
        locationSlug: "avia",
        checkoutToken: "chk_1",
        pendingPurchaseId: 88,
        poll: async () => undefined,
        attempts: 8,
        signal: abort.signal,
      }),
    ).rejects.toBeInstanceOf(HostedCheckoutClosedError);
  });
});

describe("watchNextPopup", () => {
  it("avisa cuando se cierra la ventana que abrió el pago", async () => {
    const popup = { closed: false };
    const original = window.open;
    window.open = () => popup as Window;
    const closed = vi.fn();
    const stop = watchNextPopup(closed);
    window.open("https://pay.example/checkout");
    expect(closed).not.toHaveBeenCalled();
    popup.closed = true;
    await vi.waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
    stop();
    window.open = original;
  });

  it("si el navegador bloquea el popup, vuelve al estado anterior", () => {
    const original = window.open;
    window.open = () => null;
    const closed = vi.fn();
    const stop = watchNextPopup(closed);
    window.open("https://www.paypal.com/checkoutnow");
    expect(closed).toHaveBeenCalledTimes(1);
    stop();
    window.open = original;
  });

  it("si no se abre ninguna ventana, dispara onMiss", async () => {
    const closed = vi.fn();
    const missed = vi.fn();
    const stop = watchNextPopup(closed, { missMs: 20, onMiss: missed });
    await vi.waitFor(() => expect(missed).toHaveBeenCalledTimes(1));
    expect(closed).not.toHaveBeenCalled();
    stop();
  });
});
