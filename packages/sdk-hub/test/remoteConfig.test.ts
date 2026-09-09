import { describe, expect, it } from "vitest";
import { parseStoredConfig, publicHubConfig, sanitizeHubRemoteConfig, strippedSecretKeys } from "../src/remoteConfig";

describe("sanitizeHubRemoteConfig", () => {
  it("nunca deja el secret ni claves fuera del catálogo", () => {
    expect(
      sanitizeHubRemoteConfig({
        THEME: { colorScheme: "dark" },
        CONCIERGE: {},
        API_SECRET: "leak",
        CAPTCHA_SECRET_KEY: "leak",
        CROSS_SELL: { enabled: true },
      }),
    ).toEqual({
      THEME: { colorScheme: "dark" },
      CONCIERGE: {},
    });
    expect(strippedSecretKeys({ API_SECRET: "x", THEME: {} })).toEqual(["API_SECRET"]);
  });

  it("un JSON guardado sucio se limpia al leer", () => {
    const parsed = parseStoredConfig({
      company_id: 190,
      config_json: JSON.stringify({ CONCIERGE: true, API_SECRET: "nope" }),
      updated_at: "2026-09-08T00:00:00.000Z",
      updated_by: "admin",
    });
    expect(parsed.config).toEqual({ CONCIERGE: true });
    expect(parsed.company_id).toBe(190);
  });

  it("el GET público no manda el borrador del Concierge apagado", () => {
    expect(
      publicHubConfig({
        CONCIERGE: false,
        CONCIERGE_SAVED: { displayName: "Eight Flow Yoga" },
        THEME: { colorScheme: "light" },
      }),
    ).toEqual({
      CONCIERGE: false,
      THEME: { colorScheme: "light" },
    });
  });
});
