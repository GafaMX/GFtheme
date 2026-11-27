import { afterEach, describe, expect, it, vi } from "vitest";
import { legacyOptionsToConfig } from "./config";
import { createGafaSdk } from "./runtime";
import * as payments from "./payments/gafaPay";
import { BUQ_ENVIRONMENTS } from "./config/buqEnvironments";
import { readEmbedOptionsFromDom } from "./config/embedOptions";

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
  payments.setGafaPayEnvironment("production");
  payments.setGafaPayApiUrl();
  payments.setStripePaymentScriptUrl();
  delete window.GAFAPAY_API_URL;
  document.body.innerHTML = "";
});

describe("runtime payment configuration", () => {
  it("el recorrido página → Hub → SDK → pagos rechaza la promoción de staging a producción", async () => {
    document.body.innerHTML = `<script data-gf-options type="application/json">${JSON.stringify({
      COMPANY_ID: 1, GAFA_FIT_URL: "https://buq.com.mx/", ANALYTICS: false,
    })}</script>`;
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, config: { BUQ_ENV: "production" } }) })) as unknown as typeof fetch;
    const load = vi.spyOn(payments, "loadGafaPay");
    const environment = vi.spyOn(payments, "setGafaPayEnvironment");
    const append = vi.spyOn(document.head, "appendChild");
    await expect((async () => {
      const config = await readEmbedOptionsFromDom(document, { fetchImpl, search: "" });
      const sdk = createGafaSdk(config, { useMockClient: true });
      try {
        await payments.loadGafaPay({ clientId: "test", clientSecret: "test-only", method: "stripe" });
      } finally {
        sdk.unmountAll();
      }
    })()).rejects.toThrow(/Hub.*BUQ_ENV.*producción/);
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("https://hub.buq.com.mx/v1/config?company_id=1", expect.any(Object));
    expect(environment).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(window.GAFAPAY_API_URL).toBeUndefined();
  });

  it.each([
    {}, { BUQ_ENV: "production" }, { GAFA_FIT_URL: "https://buq.partners/custom/" },
    { BUQ_ENV: "production", GAFA_FIT_URL: "https://buq.partners/custom/" },
  ])("respeta el global de API preexistente tras parsear opciones legacy: %j", (options) => {
    window.GAFAPAY_API_URL = "https://custom.example.test/payments/";
    const api = vi.spyOn(payments, "setGafaPayApiUrl");
    const sdk = createGafaSdk(legacyOptionsToConfig({ COMPANY_ID: 1, ANALYTICS: false, ...options }), { useMockClient: true });
    expect(api).not.toHaveBeenCalled();
    expect(payments.resolveGafaPayApiUrl()).toBe("https://custom.example.test/payments");
    expect(window.GAFAPAY_API_URL).toBe("https://custom.example.test/payments/");
    const box = document.createElement("div");
    const runtime = { React: { createElement: vi.fn() }, ReactDOM: { render: vi.fn(), unmountComponentAtNode: vi.fn() }, elements: {} };
    const island = payments.mountGafaPayWidget(runtime, box, "stripe", {
      order: { customerName: "Test", lineItems: [] }, generalData: {},
      onStartPayAction: vi.fn(), onGafaPaySuccessAction: vi.fn(), onGafaPayErrAction: vi.fn(),
    });
    expect(box.firstElementChild?.getAttribute("api-url")).toBe("https://custom.example.test/payments");
    island.unmount();
    sdk.unmountAll();
  });

  it("producción conserva setters manuales previos como b2c6f8a", () => {
    payments.setGafaPayApiUrl("https://manual-api.example.test");
    payments.setStripePaymentScriptUrl("https://manual.example.test/stripe.js");
    const sdk = createGafaSdk({ companyId: 1, analyticsEnabled: false }, { useMockClient: true });
    expect(payments.resolveGafaPayApiUrl()).toBe("https://manual-api.example.test");
    expect(payments.resolveStripePaymentScriptUrl()).toBe("https://manual.example.test/stripe.js");
    sdk.unmountAll();
  });

  it.each(["staging", "development"])("rechaza Laravel de producción antes de iniciar peticiones en %s", (environment) => {
    const fetch = vi.spyOn(window, "fetch");
    expect(() => createGafaSdk({ companyId: 1, environment, apiBaseUrl: "https://buq.partners/" })).toThrow(/GAFA_FIT_URL/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["production", "staging", "development"] as const)("conecta los setters de %s", (environment) => {
    const front = vi.spyOn(payments, "setGafaPayFrontUrl");
    const api = vi.spyOn(payments, "setGafaPayApiUrl");
    const stripe = vi.spyOn(payments, "setStripePaymentScriptUrl");
    const env = vi.spyOn(payments, "setGafaPayEnvironment");
    const sdk = createGafaSdk({ companyId: 1, environment, analyticsEnabled: false }, { useMockClient: true });
    const expected = BUQ_ENVIRONMENTS[environment];
    expect(front).toHaveBeenCalledWith(expected.gafaPayFrontUrl);
    if (environment === "production") {
      expect(api).not.toHaveBeenCalled();
      expect(stripe).not.toHaveBeenCalled();
    } else {
      expect(api).toHaveBeenCalledWith(expected.gafaPayApiUrl, { configureLegacy: true });
      expect(stripe).toHaveBeenCalledWith(expected.stripePaymentScriptUrl);
    }
    expect(env).toHaveBeenCalledWith(environment);
    sdk.unmountAll();
  });

  it.each(["https://custom-api.example.test", BUQ_ENVIRONMENTS.production.gafaPayApiUrl])(
    "producción respeta un override explícito nuevo, incluso el default: %s", (gafaPayApiUrl) => {
      window.GAFAPAY_API_URL = "https://old-global.example.test";
      const sdk = createGafaSdk(legacyOptionsToConfig({ COMPANY_ID: 1, ANALYTICS: false,
        BUQ_ENV: "production", GAFAPAY_API_URL: gafaPayApiUrl }), { useMockClient: true });
      expect(payments.resolveGafaPayApiUrl()).toBe(gafaPayApiUrl);
      sdk.unmountAll();
    },
  );

  it("propaga overrides explícitos y el entorno resuelto por query", () => {
    window.history.replaceState(null, "", "/?buq-env=staging");
    const api = vi.spyOn(payments, "setGafaPayApiUrl");
    const stripe = vi.spyOn(payments, "setStripePaymentScriptUrl");
    const sdk = createGafaSdk({ companyId: 1, environment: "production", analyticsEnabled: false,
      gafaPayApiUrl: "https://api.example.test", stripePaymentScriptUrl: "https://example.test/stripe.js" }, { useMockClient: true });
    expect(sdk.config.environment).toBe("staging");
    expect(api).toHaveBeenCalledWith("https://api.example.test", { configureLegacy: true });
    expect(stripe).toHaveBeenCalledWith("https://example.test/stripe.js");
    sdk.unmountAll();
  });
});
