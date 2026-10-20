import { describe, expect, it } from "vitest";
import { formatCatalogAmount, formatMoney, prefixForCurrencyCode, resolveMoneyCurrency } from "./money";

describe("resolveMoneyCurrency", () => {
  it("GTQ y Q no salen como dólar", () => {
    expect(resolveMoneyCurrency("GTQ")).toEqual({ prefix: "Q", suffix: "GTQ", code: "GTQ" });
    expect(resolveMoneyCurrency("Q")).toEqual({ prefix: "Q", suffix: "GTQ", code: "GTQ" });
    expect(resolveMoneyCurrency({ prefijo: "Q", sufijo: "GTQ", code3: "GTQ" })).toEqual({
      prefix: "Q",
      suffix: "GTQ",
      code: "GTQ",
    });
  });

  it("EUR usa €", () => {
    expect(resolveMoneyCurrency("EUR")).toEqual({ prefix: "€", suffix: "EUR", code: "EUR" });
    expect(prefixForCurrencyCode("eur")).toBe("€");
  });

  it("MXN sigue en $", () => {
    expect(resolveMoneyCurrency("MXN")?.prefix).toBe("$");
  });
});

describe("formatCatalogAmount", () => {
  it("125 GTQ es Q125, no $125", () => {
    expect(formatCatalogAmount(125, "GTQ")).toBe("Q125");
    expect(formatCatalogAmount(450, { prefijo: "Q", code3: "GTQ" })).toBe("Q450");
  });

  it("EUR no usa $", () => {
    expect(formatCatalogAmount(40, "EUR")).toBe("€40");
  });

  it("sin moneda no inventa GTQ: $ como último recurso", () => {
    expect(formatCatalogAmount(330, undefined)).toBe("$330");
  });
});

describe("formatMoney", () => {
  it("el total del carrito puede ir sin sufijo ISO", () => {
    expect(formatMoney(575, "Q", "")).toBe("Q575");
    expect(formatMoney(575, "Q", "GTQ")).toBe("Q575 GTQ");
  });
});
