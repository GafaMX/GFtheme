import { describe, expect, it } from "vitest";
import { clampPurchaseAmount, mergeCartRaw, purchaseAmountCap, readPositiveInt } from "./purchaseCap";

describe("purchaseAmountCap", () => {
  it("reservations_max=1 es una sola unidad", () => {
    expect(purchaseAmountCap({ raw: { reservations_max: 1 } })).toBe(1);
    expect(purchaseAmountCap({ raw: { reservations_max: "1" } })).toBe(1);
    expect(purchaseAmountCap({ reservationsMax: 1 })).toBe(1);
  });

  it("prefiera el JSON crudo si ambos vienen", () => {
    expect(purchaseAmountCap({ reservationsMax: 4, raw: { reservations_max: 1 } })).toBe(1);
  });

  it("sin tope en el carrito si falta o no es un entero ≥ 1", () => {
    expect(purchaseAmountCap()).toBeUndefined();
    expect(purchaseAmountCap({ raw: {} })).toBeUndefined();
    expect(purchaseAmountCap({ raw: { reservations_max: null } })).toBeUndefined();
    expect(purchaseAmountCap({ raw: { reservations_max: 0 } })).toBeUndefined();
    expect(purchaseAmountCap({ reservationsMax: 0 })).toBeUndefined();
  });

  it("capea cualquier entero positivo, no solo 1", () => {
    expect(purchaseAmountCap({ raw: { reservations_max: 3 } })).toBe(3);
  });
});

describe("clampPurchaseAmount", () => {
  it("no pasa del tope y 0 sigue siendo quitar", () => {
    expect(clampPurchaseAmount(4, 1)).toBe(1);
    expect(clampPurchaseAmount(5, 3)).toBe(3);
    expect(clampPurchaseAmount(0, 1)).toBe(0);
    expect(clampPurchaseAmount(2, undefined)).toBe(2);
  });
});

describe("mergeCartRaw", () => {
  it("conserva reservations_max si el raw nuevo no lo trae", () => {
    const merged = mergeCartRaw({ name: "Clase muestra" }, { reservations_max: 1, name: "viejo" });
    expect(merged?.reservations_max).toBe(1);
    expect(merged?.name).toBe("Clase muestra");
  });

  it("si no hay ninguno, undefined", () => {
    expect(mergeCartRaw()).toBeUndefined();
    expect(mergeCartRaw(undefined, { reservations_max: 3 })).toEqual({ reservations_max: 3 });
  });
});

describe("readPositiveInt", () => {
  it("tira basura", () => {
    expect(readPositiveInt("no")).toBeUndefined();
    expect(readPositiveInt(true)).toBeUndefined();
    expect(readPositiveInt(1.8)).toBe(1);
  });
});
