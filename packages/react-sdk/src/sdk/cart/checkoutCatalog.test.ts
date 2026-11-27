import { describe, expect, it } from "vitest";
import type { CatalogItem, GafaClient } from "../client/types";
import { fetchCheckoutCatalog } from "./checkoutCatalog";

const combo: CatalogItem = { id: 1, name: "5 clases", type: "combo", price: 1000, priceFinal: 1000 };
const membership: CatalogItem = { id: 2, name: "Mensual", type: "membership", price: 2000, priceFinal: 2000 };
const product: CatalogItem = { id: 9, name: "Agua", type: "product", price: 40, priceFinal: 40 };

describe("fetchCheckoutCatalog", () => {
  it("pide paquetes, membresías y productos en paralelo", async () => {
    const client = {
      listCombos: async () => [combo],
      listMemberships: async () => [membership],
      listProducts: async () => [product],
    } as unknown as GafaClient;

    await expect(fetchCheckoutCatalog(client, "fitspin")).resolves.toEqual({
      combos: [combo],
      memberships: [membership],
      products: [product],
    });
  });

  it("sin listProducts no tumba el catálogo: productos vacíos", async () => {
    const client = {
      listCombos: async () => [combo],
      listMemberships: async () => [membership],
    } as unknown as GafaClient;

    await expect(fetchCheckoutCatalog(client, "fitspin")).resolves.toEqual({
      combos: [combo],
      memberships: [membership],
      products: [],
    });
  });
});
