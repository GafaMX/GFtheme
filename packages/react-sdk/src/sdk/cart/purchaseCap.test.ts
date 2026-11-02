import { describe, expect, it } from "vitest";
import { clampPurchaseAmount, purchaseAmountCap, readPositiveInt } from "./purchaseCap";

describe("purchaseAmountCap", () => {
  it("reservations_max=1 es comprar una sola vez", () => {
    expect(purchaseAmountCap({ raw: { reservations_max: 1 } })).toBe(1);
    expect(purchaseAmountCap({ raw: { reservations_max: "1" } })).toBe(1);
    expect(purchaseAmountCap({ reservationsMax: 1 })).toBe(1);
  });

  it("prefiera el JSON crudo si ambos vienen", () => {
    expect(purchaseAmountCap({ reservationsMax: 4, raw: { reservations_max: 1 } })).toBe(1);
  });

  it("sin tope si falta, es 0 o no es número", () => {
    expect(purchaseAmountCap()).toBeUndefined();
    expect(purchaseAmountCap({ raw: {} })).toBeUndefined();
    expect(purchaseAmountCap({ raw: { reservations_max: null } })).toBeUndefined();
    expect(purchaseAmountCap({ raw: { reservations_max: 0 } })).toBeUndefined();
    expect(purchaseAmountCap({ reservationsMax: 0 })).toBeUndefined();
  });

  it("cap general (más de una)", () => {
    expect(purchaseAmountCap({ raw: { reservations_max: 3 } })).toBe(3);
  });
});

describe("clampPurchaseAmount", () => {
  it("no pasa del tope y 0 sigue siendo quitar", () => {
    expect(clampPurchaseAmount(4, 1)).toBe(1);
    expect(clampPurchaseAmount(0, 1)).toBe(0);
    expect(clampPurchaseAmount(2, undefined)).toBe(2);
  });
});

describe("readPositiveInt", () => {
  it("tira basura", () => {
    expect(readPositiveInt("no")).toBeUndefined();
    expect(readPositiveInt(true)).toBeUndefined();
    expect(readPositiveInt(1.8)).toBe(1);
  });
});
