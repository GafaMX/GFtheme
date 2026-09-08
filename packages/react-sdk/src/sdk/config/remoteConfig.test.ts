import { describe, expect, it, vi } from "vitest";
import { fetchHubRemoteConfig, mergeSdkOptionLayers, sanitizeHubRemoteConfig } from "./remoteConfig";
import { queryOptionOverrides, readEmbedOptionsFromDom } from "./embedOptions";

describe("sanitizeHubRemoteConfig", () => {
  it("tira secretos y claves que no son del catálogo", () => {
    expect(
      sanitizeHubRemoteConfig({
        THEME: { colorScheme: "dark" },
        CONCIERGE: true,
        API_SECRET: "nope",
        clientSecret: "nope",
        CAPTCHA_SECRET_KEY: "nope",
        CROSS_SELL: { enabled: true },
      }),
    ).toEqual({
      THEME: { colorScheme: "dark" },
      CONCIERGE: true,
    });
  });
});

describe("mergeSdkOptionLayers", () => {
  it("defaults → Hub → página → query, y el secret de la página sobrevive", () => {
    const merged = mergeSdkOptionLayers({
      hub: {
        THEME: { colorScheme: "dark", colors: { brand: "#111111" } },
        CONCIERGE: true,
        API_SECRET: "from-hub",
        BUQ_ENV: "staging",
      },
      page: {
        COMPANY_ID: 190,
        API_CLIENT: "203",
        API_SECRET: "from-page",
        THEME: { colors: { brand: "#F3D15E" } },
      },
      query: { BUQ_ENV: "development", HUB_URL: "http://127.0.0.1:8787" },
    });
    expect(merged.API_SECRET).toBe("from-page");
    expect(merged.CONCIERGE).toBe(true);
    expect(merged.THEME).toEqual({ colorScheme: "dark", colors: { brand: "#F3D15E" } });
    expect(merged.BUQ_ENV).toBe("development");
    expect(merged.HUB_URL).toBe("http://127.0.0.1:8787");
    expect(merged.COMPANY_ID).toBe(190);
  });
});

describe("queryOptionOverrides", () => {
  it("solo lee buq-env y hub-url", () => {
    expect(queryOptionOverrides("?buq-env=staging&hub-url=http://127.0.0.1:8787&token=x")).toEqual({
      BUQ_ENV: "staging",
      HUB_URL: "http://127.0.0.1:8787",
    });
  });
});

describe("fetchHubRemoteConfig", () => {
  it("fail-open si el Hub no responde", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(
      fetchHubRemoteConfig({ hubUrl: "https://hub.buq.partners", companyId: 190, fetchImpl }),
    ).resolves.toBeNull();
  });

  it("devuelve el partial sanitizado", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        company_id: 190,
        config: { CONCIERGE: true, API_SECRET: "nope" },
      }),
    })) as unknown as typeof fetch;
    await expect(
      fetchHubRemoteConfig({ hubUrl: "https://hub.buq.partners/", companyId: 190, fetchImpl }),
    ).resolves.toEqual({ CONCIERGE: true });
  });
});

describe("readEmbedOptionsFromDom", () => {
  it("mezcla el partial del Hub encima de defaults y debajo del HTML", async () => {
    document.body.innerHTML = `
      <script data-gf-options type="application/json">${JSON.stringify({
        COMPANY_ID: 190,
        API_CLIENT: "203",
        API_SECRET: "from-page",
      })}</script>
    `;
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        config: { THEME: { colorScheme: "dark" }, CONCIERGE: true, API_SECRET: "from-hub" },
      }),
    })) as unknown as typeof fetch;
    const config = await readEmbedOptionsFromDom(document, { fetchImpl, search: "" });
    expect(config.companyId).toBe(190);
    expect(config.clientSecret).toBe("from-page");
    expect(config.theme).toEqual(expect.objectContaining({ colorScheme: "dark" }));
    expect(config.concierge).toBe(true);
    document.body.innerHTML = "";
  });
});
