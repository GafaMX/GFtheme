import { describe, expect, it } from "vitest";
import type { CatalogItem, GafaClient } from "../client/types";
import {
  itemAlreadyInCart,
  parseCrossSell,
  purchaseAssociation,
  resolveCrossSellItems,
} from "./crossSell";

const sculpt: CatalogItem = {
  id: 2878,
  name: "SCULPT",
  type: "combo",
  price: 275,
  priceFinal: 275,
};

describe("parseCrossSell", () => {
  it("acepta el shape plano del Hub", () => {
    expect(
      parseCrossSell({
        enabled: true,
        payTitle: " ¿Donación? ",
        thanksTitle: "¿Proteína?",
        itemType: "combo",
        itemId: "971",
      }),
    ).toEqual({
      enabled: true,
      payTitle: "¿Donación?",
      thanksTitle: "¿Proteína?",
      items: [{ type: "combo", id: 971 }],
    });
  });

  it("acepta items[] y no duplica el ID plano", () => {
    expect(
      parseCrossSell({
        items: [{ type: "product", id: 9 }],
        itemType: "product",
        itemId: 9,
      }),
    ).toEqual({
      enabled: true,
      payTitle: "",
      thanksTitle: "",
      items: [{ type: "product", id: 9 }],
    });
  });

  it("apagado o sin ID no muestra oferta", () => {
    expect(parseCrossSell({ enabled: false, itemId: 971 })).toBeNull();
    expect(parseCrossSell({ enabled: true })).toBeNull();
    expect(parseCrossSell(true)).toBeNull();
    expect(parseCrossSell(null)).toBeNull();
  });
});

describe("purchaseAssociation", () => {
  it("si ya hay reserva, manda reservations_id y no meetings_id", () => {
    expect(purchaseAssociation({ meetingId: 849768, reservationId: 3509997 })).toEqual({
      reservationId: 3509997,
    });
  });

  it("si la reserva aún no existe, manda meetings_id", () => {
    expect(purchaseAssociation({ meetingId: 849768 })).toEqual({ meetingId: 849768 });
  });
});

describe("itemAlreadyInCart", () => {
  it("omite la oferta si el ID ya está en el pedido", () => {
    expect(itemAlreadyInCart([{ id: 971, type: "combo" }], { id: 971, type: "combo" })).toBe(true);
    expect(itemAlreadyInCart([{ id: 971, type: "combo" }], { id: 2878, type: "combo" })).toBe(false);
  });
});

describe("resolveCrossSellItems", () => {
  it("usa el catálogo local y no pide a gafa.fit", async () => {
    const client = {
      listBrands: async () => {
        throw new Error("no debería listar marcas");
      },
    } as unknown as GafaClient;
    const resolved = await resolveCrossSellItems(
      client,
      [{ type: "combo", id: 2878 }],
      { combos: [sculpt], memberships: [] },
      "fitspin",
    );
    expect(resolved).toEqual([{ ref: { type: "combo", id: 2878 }, item: sculpt, brandSlug: "fitspin" }]);
  });
});
