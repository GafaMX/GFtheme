import { describe, expect, it } from "vitest";
import type { CatalogItem, GafaClient } from "../client/types";
import { findPurchasableItem, matchInPools, sameCatalogId } from "./findPurchasable";

const combo = (id: number, name: string): CatalogItem => ({
  id,
  name,
  type: "combo",
  price: 100,
  priceFinal: 100,
});

const membership = (id: number, name: string): CatalogItem => ({
  id,
  name,
  type: "membership",
  price: 200,
  priceFinal: 200,
});

describe("sameCatalogId", () => {
  it("iguala number y string", () => {
    expect(sameCatalogId(971, "971")).toBe(true);
    expect(sameCatalogId("1622", 1622)).toBe(true);
    expect(sameCatalogId(971, 1622)).toBe(false);
  });
});

describe("matchInPools", () => {
  it("encuentra el combo aunque el HTML lo haya marcado como membresia", () => {
    const item = matchInPools(
      { type: "membership", id: 971 },
      { combos: [combo(971, "1 CLASE")], memberships: [membership(358, "CDMX")] },
    );
    expect(item?.name).toBe("1 CLASE");
  });
});

describe("findPurchasableItem", () => {
  it("busca en la segunda marca si el paquete no vive en la primera", async () => {
    const client = {
      listBrands: async () => [
        { id: 1, name: "Cancun", slug: "fitspin-cancun" },
        { id: 2, name: "Fitspin", slug: "fitspin" },
      ],
      listCombos: async (brandSlug: string) =>
        brandSlug === "fitspin" ? [combo(971, "1 CLASE Lomas")] : [combo(1622, "1 CLASE Cancun")],
      listMemberships: async () => [],
    } as unknown as GafaClient;

    const match = await findPurchasableItem(client, { type: "combo", id: 971 });
    expect(match?.brandSlug).toBe("fitspin");
    expect(match?.item.name).toBe("1 CLASE Lomas");
  });
});
