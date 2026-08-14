import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapPurchaseButtons, type PurchaseIntent } from "./purchaseButtons";

describe("bootstrapPurchaseButtons", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lee data-gf-combo-id y dispara la compra", () => {
    const onPurchase = vi.fn();
    const stop = bootstrapPurchaseButtons({
      onPurchase,
      onOpenCart: vi.fn(),
    });

    document.body.innerHTML = `<button data-gf-buy data-gf-combo-id="971">Comprar</button>`;
    document.querySelector("button")?.click();

    expect(onPurchase).toHaveBeenCalledTimes(1);
    const intent = onPurchase.mock.calls[0][0] as PurchaseIntent;
    expect(intent).toMatchObject({ type: "combo", id: 971 });
    stop();
  });

  it("acepta los alias legacy data-bq-*", () => {
    const onPurchase = vi.fn();
    const stop = bootstrapPurchaseButtons({
      onPurchase,
      onOpenCart: vi.fn(),
    });

    document.body.innerHTML = `
      <section data-gf-buy data-bq-membership-id="358" data-bq-location-id="122">
        <button>COMPRAR</button>
      </section>
    `;
    document.querySelector("button")?.click();

    expect(onPurchase).toHaveBeenCalledTimes(1);
    expect(onPurchase.mock.calls[0][0]).toMatchObject({
      type: "membership",
      id: 358,
      locationId: 122,
    });
    stop();
  });
});
