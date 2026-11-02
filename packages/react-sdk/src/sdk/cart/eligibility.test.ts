import { describe, expect, it } from "vitest";
import type { CartLine } from "./cartStore";
import { findIneligibleLines, isEligibilityRejection } from "./eligibility";

const line = (id: number): CartLine => ({
  key: `b:combo:${id}`, id, type: "combo", name: `P${id}`, price: 1, priceLabel: "$1", amount: 1, brandSlug: "b",
});
const apiErr = (msg: string, status: number) => Object.assign(new Error(msg), { status });

describe("isEligibilityRejection", () => {
  it("regla de producto sí", () => {
    expect(isEligibilityRejection(new Error("Este producto no puede ser comprado porque es de uso restringido."))).toBe(true);
    expect(isEligibilityRejection(apiErr("límite", 422))).toBe(true);
  });
  it("red, sesión o servidor no", () => {
    expect(isEligibilityRejection(new TypeError("Failed to fetch"))).toBe(false);
    expect(isEligibilityRejection(apiErr("x", 401))).toBe(false);
    expect(isEligibilityRejection(apiErr("x", 419))).toBe(false);
    expect(isEligibilityRejection(apiErr("x", 500))).toBe(false);
    expect(isEligibilityRejection("nope")).toBe(false);
  });
});

describe("findIneligibleLines", () => {
  it("una sola línea: es la mala", async () => {
    const r = await findIneligibleLines([line(1)], new Error("e"), async () => undefined);
    expect(r.bad.map((l) => l.id)).toEqual([1]);
  });
  it("separa la restringida de las válidas y conserva fallos de red", async () => {
    const r = await findIneligibleLines([line(1), line(2), line(3)], new Error("combo"), async (l) => {
      if (l.id === 2) throw new Error("uso restringido");
      if (l.id === 3) throw new TypeError("Failed to fetch");
    });
    expect(r.bad.map((l) => l.id)).toEqual([2]);
    expect((r.error as Error).message).toBe("uso restringido");
  });
});
