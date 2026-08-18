import { describe, expect, it } from "vitest";
import { gafaFitProductType, partitionGafaFitCart, toGafaFitCartItem } from "./gafaFitCart";

describe("gafaFitProductType", () => {
  it("usa las clases Eloquent del fancy v1, no el slug corto", () => {
    expect(gafaFitProductType("combo")).toBe("App\\Models\\Combos\\Combos");
    expect(gafaFitProductType("membership")).toBe("App\\Models\\Membership\\Membership");
    expect(gafaFitProductType("product")).toBe("App\\Models\\Products\\Product");
  });
});

describe("toGafaFitCartItem", () => {
  it("arma el objeto que sendInitialPurchaseForm mete en cart/combo", () => {
    expect(
      toGafaFitCartItem({
        id: 971,
        type: "combo",
        amount: 2,
        name: "1 clase",
        price: 330,
        companiesId: 80,
      }),
    ).toEqual({
      id: 971,
      type: "combo",
      amount: 2,
      name: "1 clase",
      price_final: 330,
      product_type: "App\\Models\\Combos\\Combos",
      companies_id: 80,
    });
  });

  it("manda el JSON del API entero, como el Object.assign del fancy v1", () => {
    const item = toGafaFitCartItem({
      id: 971,
      type: "combo",
      amount: 1,
      name: "1 clase",
      price: 330,
      companiesId: 80,
      raw: {
        id: 971,
        name: "1 clase",
        price: "330.00",
        price_final: "330.00",
        credits: 1,
        expiration_days: 30,
        companies_id: 80,
        created_at: "2020-01-01T00:00:00.000000Z",
      },
    });

    // Claves del API que v2 no normaliza pero gafa.fit sí puede leer.
    expect(item.credits).toBe(1);
    expect(item.expiration_days).toBe(30);
    expect(item.created_at).toBe("2020-01-01T00:00:00.000000Z");
    // El API manda price_final como string y así viaja (igual que v1).
    expect(item.price_final).toBe("330.00");
    expect(item.companies_id).toBe(80);
    // Lo que el checkout controla pisa al raw.
    expect(item.amount).toBe(1);
    expect(item.type).toBe("combo");
    expect(item.product_type).toBe("App\\Models\\Combos\\Combos");
  });
});

describe("partitionGafaFitCart", () => {
  it("separa combos, membresías y productos como el fancy v1", () => {
    const partitioned = partitionGafaFitCart([
      { id: 971, type: "combo", amount: 1, name: "1 clase", price: 330 },
      { id: 12, type: "membership", amount: 1, name: "Mensual" },
    ]);

    expect(partitioned.combosId).toEqual([971]);
    expect(partitioned.combosAmounts).toEqual([1]);
    expect(partitioned.membershipsId).toEqual([12]);
    expect(partitioned.productsId).toEqual([]);
    expect(partitioned.cart).toHaveLength(2);
    expect(partitioned.combo[0]?.product_type).toBe("App\\Models\\Combos\\Combos");
    expect(partitioned.membership[0]?.product_type).toBe("App\\Models\\Membership\\Membership");
  });
});
