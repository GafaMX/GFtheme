import { describe, expect, it } from "vitest";
import {
  AUTO_GIFT_CODE_LENGTH,
  buildCheckGiftUrl,
  buildGenerateGiftUrl,
  extractGeneratedGiftCode,
  formatGiftCodeDisplay,
  generateShortGiftCode,
  giftCardsEnabledFromUrls,
  giftCodeAvailability,
  isPlausibleGiftCode,
  looksLikeExistingGiftCard,
  normalizeGiftCode,
  parseGiftCodeCheckResponse,
  preferShortGeneratedCode,
} from "./giftCard";

describe("giftCardsEnabledFromUrls", () => {
  it("enciende el bloque si hay check o generate, como el fancy v1", () => {
    expect(giftCardsEnabledFromUrls({ checkGiftCode: "https://x/check" })).toBe(true);
    expect(giftCardsEnabledFromUrls({ generateGiftCode: "https://x/generate-code" })).toBe(true);
    expect(giftCardsEnabledFromUrls({})).toBe(false);
  });
});

describe("generateShortGiftCode", () => {
  it("genera 8 caracteres fáciles de dictar, no un hex largo", () => {
    const code = generateShortGiftCode(() => 0);
    expect(code).toHaveLength(AUTO_GIFT_CODE_LENGTH);
    expect(code).toBe("AAAAAAAA");
    expect(code).not.toMatch(/[0O1IL]/);
    expect(formatGiftCodeDisplay(code)).toBe("AAAA-AAAA");
  });
});

describe("normalizeGiftCode", () => {
  it("quita guiones y espacios y pasa a mayúsculas", () => {
    expect(normalizeGiftCode("ab12-cd34")).toBe("AB12CD34");
    expect(isPlausibleGiftCode("AB")).toBe(false);
    expect(isPlausibleGiftCode("MARIA26")).toBe(true);
  });
});

describe("preferShortGeneratedCode", () => {
  it("descarta el hex largo de generate-code y usa uno corto", () => {
    expect(preferShortGeneratedCode("90AE0C89F5D1466A7C91E2F988")).toHaveLength(8);
    expect(preferShortGeneratedCode("K7M2P9QX")).toBe("K7M2P9QX");
  });
});

describe("extractGeneratedGiftCode", () => {
  it("lee code / gift_code del JSON de generate-code", () => {
    expect(extractGeneratedGiftCode({ code: "ab12-cd34" })).toBe("AB12CD34");
    expect(extractGeneratedGiftCode({ data: { gift_code: "hola12" } })).toBe("HOLA12");
    expect(extractGeneratedGiftCode("n7p4-q2k8")).toBe("N7P4Q2K8");
  });
});

describe("buildCheckGiftUrl / buildGenerateGiftUrl", () => {
  const base = {
    apiBaseUrl: "https://buq.partners/",
    brandSlug: "fitspin",
    locationSlug: "helipuerto",
  };

  it("usa _|_ del fancy para check-gift-code", () => {
    const url = buildCheckGiftUrl({
      ...base,
      code: "ab12-cd34",
      urlTemplate:
        "https://buq.partners/api/brand/fitspin/location/helipuerto/reservation/check-gift-code/_|_",
    });
    expect(url.pathname).toBe(
      "/api/brand/fitspin/location/helipuerto/reservation/check-gift-code/AB12CD34",
    );
  });

  it("arma generate-code si el template no viene", () => {
    const url = buildGenerateGiftUrl(base);
    expect(url.pathname).toBe(
      "/api/brand/fitspin/location/helipuerto/reservation/generate-code",
    );
  });
});

describe("parseGiftCodeCheckResponse + giftCodeAvailability", () => {
  it("200 con gift existente = código ocupado (no se canjea en checkout)", () => {
    const result = parseGiftCodeCheckResponse("EXISTE", true, 200, {
      id: 88,
      code: "EXISTE",
      balance: 1275,
      name: "5 clases",
    });
    expect(result.valid).toBe(true);
    expect(looksLikeExistingGiftCard(result.raw)).toBe(true);
    expect(giftCodeAvailability(result)).toEqual({
      status: "taken",
      message: "este código ya está en uso",
    });
  });

  it("404 / no existe = disponible para Convertir en GiftCard", () => {
    const result = parseGiftCodeCheckResponse("NUEVO12", false, 404, {
      message: "Gift card not found",
    });
    expect(result.valid).toBe(false);
    expect(giftCodeAvailability(result).status).toBe("available");
  });

  it("200 sin objeto gift = disponible", () => {
    const result = parseGiftCodeCheckResponse("LIBRE12", true, 200, { ok: true });
    expect(result.valid).toBe(false);
    expect(giftCodeAvailability(result).status).toBe("available");
  });

  it("500 no deja pasar el código como válido", () => {
    const result = parseGiftCodeCheckResponse("X", false, 500, { message: "Server error" });
    expect(giftCodeAvailability(result)).toEqual({
      status: "invalid",
      message: "no pudimos validar el código",
    });
  });

  it("422 de formato inválido", () => {
    const result = parseGiftCodeCheckResponse("??", false, 422, {
      message: "The given data was invalid.",
      errors: { code: ["Código inválido"] },
    });
    expect(giftCodeAvailability(result).status).toBe("invalid");
  });
});
