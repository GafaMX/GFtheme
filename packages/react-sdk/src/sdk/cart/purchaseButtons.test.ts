import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapPurchaseButtons, type PurchaseIntent, type ReserveIntent } from "./purchaseButtons";

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

  it("lee data-gf-reserve y dispara la reserva de esa clase", () => {
    const onReserve = vi.fn();
    const stop = bootstrapPurchaseButtons({
      onPurchase: vi.fn(),
      onOpenCart: vi.fn(),
      onReserve,
    });

    document.body.innerHTML = `
      <a href="#" data-gf-reserve data-gf-meeting-id="84213" data-gf-brand="fitspin" data-gf-location="lomas">
        Reservar
      </a>
    `;
    document.querySelector("a")?.click();

    expect(onReserve).toHaveBeenCalledTimes(1);
    expect(onReserve.mock.calls[0][0] as ReserveIntent).toMatchObject({
      meetingId: 84213,
      brandSlug: "fitspin",
      locationSlug: "lomas",
    });
    stop();
  });

  it("acepta el id directo en data-gf-reserve", () => {
    const onReserve = vi.fn();
    const stop = bootstrapPurchaseButtons({
      onPurchase: vi.fn(),
      onOpenCart: vi.fn(),
      onReserve,
    });

    document.body.innerHTML = `<button data-gf-reserve="84213">Reservar</button>`;
    document.querySelector("button")?.click();

    expect(onReserve.mock.calls[0][0]).toMatchObject({ meetingId: 84213 });
    stop();
  });
});
