import { describe, expect, it } from "vitest";
import { DEMO_CONCIERGE_CONFIG } from "./fixtures";
import { GENERATED_CONCIERGE_DISPLAY_NAME, resolveConciergeFromInput } from "./resolveConfig";

const context = {
  companyId: 190,
  theme: { colorScheme: "dark" as const, colors: { brand: "#c8ff2e" } },
};

describe("resolveConciergeFromInput", () => {
  it("true y {} arman el default live", () => {
    for (const input of [true, {}]) {
      const config = resolveConciergeFromInput(input, context);
      expect(config.id).toBe("company-190");
      expect(config.displayName).toBe(GENERATED_CONCIERGE_DISPLAY_NAME);
      expect(config.buq.companyId).toBe(190);
      expect(config.catalog).toEqual({ version: "live", products: [], live: true });
      expect(config.theme.mode).toBe("dark");
      expect(config.theme.accent).toBe("#c8ff2e");
      expect(config.contact.whatsapp).toBeUndefined();
    }
  });

  it("un partial se mezcla encima del default", () => {
    const config = resolveConciergeFromInput(
      {
        id: "bunker",
        displayName: "Bunker Indoor Golf",
        contact: { whatsapp: "5215512345678" },
      },
      context,
    );
    expect(config.id).toBe("bunker");
    expect(config.displayName).toBe("Bunker Indoor Golf");
    expect(config.contact.whatsapp).toBe("5215512345678");
    expect(config.capabilities.whatsapp).toBe(true);
    expect(config.catalog.live).toBe(true);
    expect(config.copy.greeting).toContain("Bunker Indoor Golf");
  });

  it("un objeto completo sigue parseándose tal cual", () => {
    const config = resolveConciergeFromInput(DEMO_CONCIERGE_CONFIG, { companyId: 80 });
    expect(config.id).toBe(DEMO_CONCIERGE_CONFIG.id);
    expect(config.catalog.live).toBeUndefined();
    expect(config.displayName).toBe(DEMO_CONCIERGE_CONFIG.displayName);
  });

  it("sin COMPANY_ID no inventa defaults", () => {
    expect(() => resolveConciergeFromInput(true, { companyId: 0 })).toThrow(/COMPANY_ID/);
  });
});
