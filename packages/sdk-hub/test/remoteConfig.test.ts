import { describe, expect, it } from "vitest";
import { parseStoredConfig, sanitizeHubRemoteConfig, strippedSecretKeys } from "../src/remoteConfig";

describe("sanitizeHubRemoteConfig", () => {
  it("nunca deja el secret ni claves fuera del catálogo", () => {
    expect(
      sanitizeHubRemoteConfig({
        THEME: { colorScheme: "dark" },
        CONCIERGE: {},
        API_SECRET: "leak",
        CAPTCHA_SECRET_KEY: "leak",
        CROSS_SELL: { enabled: true, itemId: 971 },
        WEIRD_KEY: true,
      }),
    ).toEqual({
      THEME: { colorScheme: "dark" },
      CONCIERGE: {},
      CROSS_SELL: { enabled: true, itemId: 971 },
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
});
