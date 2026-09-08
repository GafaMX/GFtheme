import { describe, expect, it } from "vitest";
import { ConciergePartnerConfig } from "./contracts";
import { createLiveConciergeConfig } from "./liveConfig";

describe("createLiveConciergeConfig", () => {
  it("arma una config de compañía con catálogo vacío para hidratar", () => {
    const config = createLiveConciergeConfig({
      id: "bunker",
      displayName: "Bunker Indoor Golf",
      companyId: 190,
      theme: { mode: "dark", accent: "#c8ff2e", foreground: "#111111" },
    });
    expect(ConciergePartnerConfig.parse(config).id).toBe("bunker");
    expect(config.displayName).toBe("Bunker Indoor Golf");
    expect(config.buq.companyId).toBe(190);
    expect(config.catalog.live).toBe(true);
    expect(config.catalog.products).toEqual([]);
    expect(config.copy.greeting).toContain("Bunker Indoor Golf");
    expect(config.copy.greeting).not.toContain("Demo Studio");
    expect(config.capabilities.memberships).toBe(true);
    expect(config.contact.whatsapp).toBeUndefined();
    expect(config.capabilities.whatsapp).toBe(false);
  });

  it("solo pone WhatsApp si el socio pasa el número", () => {
    const config = createLiveConciergeConfig({
      id: "bunker",
      displayName: "Bunker Indoor Golf",
      companyId: 190,
      theme: { mode: "dark", accent: "#c8ff2e", foreground: "#111111" },
      whatsapp: "5215512345678",
    });
    expect(config.contact.whatsapp).toBe("5215512345678");
    expect(config.capabilities.whatsapp).toBe(true);
  });
});
