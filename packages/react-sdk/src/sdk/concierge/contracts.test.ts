import { describe, expect, it } from "vitest";
import { ConciergePartnerConfig, ConciergeResponseSchema } from "./contracts";
import { DEMO_CONCIERGE_CONFIG, FITSPIN_CONCIERGE_CONFIG } from "./fixtures";

describe("concierge contracts", () => {
  it("valida los fixtures de referencia", () => {
    expect(ConciergePartnerConfig.parse(FITSPIN_CONCIERGE_CONFIG).id).toBe("fitspin");
    expect(ConciergePartnerConfig.parse(DEMO_CONCIERGE_CONFIG).id).toBe("demo-studio");
  });

  it("no comparte catalogo ni marcas entre socios", () => {
    const fitspin = ConciergePartnerConfig.parse(FITSPIN_CONCIERGE_CONFIG);
    const demo = ConciergePartnerConfig.parse(DEMO_CONCIERGE_CONFIG);
    expect(fitspin.buq.companyId).not.toBe(demo.buq.companyId);
    expect(fitspin.catalog.products.some((product) => product.id === demo.catalog.products[0].id)).toBe(false);
    expect(demo.studios.some((studio) => fitspin.studios.some((other) => other.locationId === studio.locationId))).toBe(false);
  });

  it("permite catalogo vacio cuando el socio hidrata desde BUQ", () => {
    const parsed = ConciergePartnerConfig.parse({
      ...DEMO_CONCIERGE_CONFIG,
      studios: [],
      catalog: { version: "live", products: [], live: true },
    });
    expect(parsed.catalog.live).toBe(true);
    expect(parsed.catalog.products).toEqual([]);
    expect(parsed.studios).toEqual([]);
  });

  it("rechaza una respuesta de IA sin version v1", () => {
    expect(ConciergeResponseSchema.safeParse({ message: "hola" }).success).toBe(false);
  });
});
