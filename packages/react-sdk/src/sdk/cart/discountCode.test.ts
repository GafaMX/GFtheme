import { describe, expect, it } from "vitest";
import {
  buildCheckDiscountUrl,
  discountAmountFromCode,
  parseDiscountCheckResponse,
  resolveDiscountAmount,
} from "./discountCode";

const base = {
  apiBaseUrl: "https://buq.partners/",
  brandSlug: "fitspin",
  locationSlug: "helipuerto",
  code: "BUQMX",
  lines: [{ id: 971, type: "combo" as const }],
};

describe("buildCheckDiscountUrl", () => {
  it("pone el perfil del usuario en la ruta, no el meeting", () => {
    const url = buildCheckDiscountUrl({ ...base, userProfileId: 4412 });
    expect(url.pathname).toBe(
      "/api/brand/fitspin/location/helipuerto/reservation/check-discount-code/BUQMX/4412",
    );
    expect(url.pathname.endsWith("/123456")).toBe(false);
    expect(url.searchParams.getAll("combo[]")).toEqual(["971"]);
  });

  it("usa la URL del fancy y sustituye _|_", () => {
    const url = buildCheckDiscountUrl({
      ...base,
      urlTemplate:
        "https://buq.partners/api/brand/fitspin/location/helipuerto/reservation/check-discount-code/_|_/4412",
      userProfileId: 1,
    });
    expect(url.pathname).toContain("/check-discount-code/BUQMX/4412");
    expect(url.pathname).not.toContain("_|_");
  });

  it("no arma la ruta si falta el perfil y no hay template", () => {
    expect(() => buildCheckDiscountUrl({ ...base })).toThrow(/validar el código/i);
  });
});

describe("discountAmountFromCode", () => {
  it("aplica percent sobre el subtotal (BUQMX = 90%)", () => {
    expect(discountAmountFromCode({ discountType: "percent", discountNumber: 90 }, 330)).toBe(297);
  });

  it("aplica price como monto fijo, igual que el fancy v1", () => {
    expect(discountAmountFromCode({ discountType: "price", discountNumber: 50 }, 330)).toBe(50);
  });
});

describe("parseDiscountCheckResponse", () => {
  it("lee el objeto real de gafa.fit (discount_type + discount_number)", () => {
    const result = parseDiscountCheckResponse("BUQMX", true, {
      id: 1722,
      code: "BUQMX",
      discount_type: "percent",
      discount_number: 90,
    });
    expect(result.valid).toBe(true);
    expect(result.discountType).toBe("percent");
    expect(result.discountNumber).toBe(90);
    expect(result.label).toBe("BUQMX · 90%");
    expect(resolveDiscountAmount(result, 330)).toBe(297);
  });

  it("trata el 404 de UserProfile (meetingId mal puesto) como inválido", () => {
    const result = parseDiscountCheckResponse("BUQMX", false, {
      message: "No query results for model [App\\Models\\User\\UserProfile] 98765",
    });
    expect(result.valid).toBe(false);
  });

  it("saca el mensaje de un 422 de código inexistente", () => {
    const result = parseDiscountCheckResponse("NOEXISTE", false, {
      message: "The given data was invalid.",
      errors: { user: ["Código de descuento inválido"] },
    });
    expect(result.valid).toBe(false);
    expect(result.message).toBe("Código de descuento inválido");
  });

  it("trata el body string de 'sin producto' como error, no como éxito", () => {
    const result = parseDiscountCheckResponse("BUQMX", true, "No se ha definido un producto válido.");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/producto/i);
  });
});
