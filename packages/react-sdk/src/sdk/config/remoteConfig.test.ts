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
        CROSS_SELL: { enabled: true, itemId: 971 },
        WEIRD_KEY: true,
      }),
    ).toEqual({
      THEME: { colorScheme: "dark" },
      CONCIERGE: true,
      CROSS_SELL: { enabled: true, itemId: 971 },
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

  /**
   * Los sitios que ya están instalados traen todo escrito en el HTML. El Hub
   * no puede cambiarles nada de eso: solo rellena lo que la página no declaró.
   */
  describe("una página que ya trae su config", () => {
    const paginaInstalada = {
      COMPANY_ID: 190,
      API_CLIENT: "203",
      API_SECRET: "from-page",
      ANALYTICS: true,
      SHOW_MEMBERSHIP_OPTIONS: true,
      THEME: { colors: { brand: "#f3d15e" }, logoUrl: "https://sitio.mx/logo.svg" },
      CONCIERGE: { displayName: "El de la página", contact: { whatsapp: "5215500000000" } },
    };

    const hubQueContradice = {
      ANALYTICS: false,
      SHOW_MEMBERSHIP_OPTIONS: false,
      THEME: { colorScheme: "dark", colors: { brand: "#000000", accent: "#ff5c00" } },
      CONCIERGE: { displayName: "El del Hub", contact: { whatsapp: "5215599999999" } },
    };

    const montar = (options: Record<string, unknown>) => {
      document.body.innerHTML = `<script data-gf-options type="application/json">${JSON.stringify(options)}</script>`;
    };

    const hubRespondiendo = (config: Record<string, unknown>) =>
      vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, config }) })) as unknown as typeof fetch;

    it("el HTML le gana al Hub en todo lo que ya declara", async () => {
      montar(paginaInstalada);
      const config = await readEmbedOptionsFromDom(document, {
        fetchImpl: hubRespondiendo(hubQueContradice),
        search: "",
      });
      expect(config.analyticsEnabled).toBe(true);
      expect(config.showMembershipOptions).toBe(true);
      expect(config.theme?.colors?.brand).toBe("#f3d15e");
      expect(config.theme?.logoUrl).toBe("https://sitio.mx/logo.svg");
      expect(config.concierge).toEqual({
        displayName: "El de la página",
        contact: { whatsapp: "5215500000000" },
      });
      document.body.innerHTML = "";
    });

    it("el Hub sí agrega lo que la página nunca escribió, aunque sea dentro de THEME", async () => {
      montar(paginaInstalada);
      const config = await readEmbedOptionsFromDom(document, {
        fetchImpl: hubRespondiendo(hubQueContradice),
        search: "",
      });
      expect(config.theme?.colorScheme).toBe("dark");
      expect(config.theme?.colors?.accent).toBe("#ff5c00");
      document.body.innerHTML = "";
    });

    it("si el Hub no contesta, la página arranca igual que hoy", async () => {
      montar(paginaInstalada);
      const caido = vi.fn(async () => {
        throw new Error("offline");
      });
      const conHubCaido = await readEmbedOptionsFromDom(document, { fetchImpl: caido, search: "" });
      const sinHub = await readEmbedOptionsFromDom(document, { fetchRemote: false, search: "" });
      expect(conHubCaido).toEqual(sinHub);
      document.body.innerHTML = "";
    });
  });
});
