import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BUQ_ENVIRONMENTS } from "./config/buqEnvironments";

let pay: typeof import("./payments/gafaPay");
let createGafaSdk: typeof import("./runtime").createGafaSdk;
const input = { companyId: 1, analyticsEnabled: false };

beforeEach(async () => {
  vi.resetModules();
  pay = await import("./payments/gafaPay");
  ({ createGafaSdk } = await import("./runtime"));
});
afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  delete window.GAFAPAY_API_URL;
  delete window.GafaPayElements;
  delete window.React;
  delete window.ReactDOM;
});

it.each(["defaults", "global", "manual"])("crear → destruir → crear restaura producción (%s)", (source) => {
  if (source !== "defaults") window.GAFAPAY_API_URL = "https://page-api.example.test/";
  if (source === "manual") {
    pay.setGafaPayApiUrl("https://manual-api.example.test");
    pay.setStripePaymentScriptUrl("https://manual.example.test/stripe.js");
  }
  const production = createGafaSdk(input, { useMockClient: true });
  const api = pay.resolveGafaPayApiUrl();
  const stripe = pay.resolveStripePaymentScriptUrl();
  production.unmountAll();
  const staging = createGafaSdk({ ...input, environment: "staging" }, { useMockClient: true });
  expect(pay.resolveGafaPayApiUrl()).toBe(BUQ_ENVIRONMENTS.staging.gafaPayApiUrl);
  staging.unmountAll();
  const recreated = createGafaSdk(input, { useMockClient: true });
  try {
    expect(recreated.config.apiBaseUrl).toBe(BUQ_ENVIRONMENTS.production.apiBaseUrl);
    expect(pay.resolveGafaPayFrontUrl()).toBe(BUQ_ENVIRONMENTS.production.gafaPayFrontUrl);
    expect(pay.resolveGafaPayApiUrl()).toBe(api);
    expect(pay.resolveStripePaymentScriptUrl()).toBe(stripe);
    expect(window.GAFAPAY_API_URL).toBe(source === "defaults" ? undefined : "https://page-api.example.test/");
  } finally { recreated.unmountAll(); }
});

it.each(["stripe", "recurrente"])("bloquea staging → producción si %s empezó a cargar", async (method) => {
  const sdk = createGafaSdk({ ...input, environment: "staging" }, { useMockClient: true });
  window.React = { version: "16.8.6", createElement: vi.fn() };
  window.ReactDOM = { render: vi.fn(), unmountComponentAtNode: vi.fn() };
  let stripeDefined = false;
  vi.spyOn(customElements, "get").mockImplementation(() => stripeDefined ? class extends HTMLElement {} : undefined);
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    if ((node as HTMLScriptElement).src) {
      stripeDefined = method === "stripe";
      if (!stripeDefined) window.GafaPayElements = {};
      node.dispatchEvent(new Event("load"));
    }
    return node;
  });
  const loading = pay.loadGafaPay({ clientId: "test", clientSecret: "test-only", method });
  sdk.unmountAll();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  // Bloquear también mientras el proveedor está en vuelo, antes de reutilizar su caché.
  expect(() => createGafaSdk(input, { useMockClient: true })).toThrow(pay.PAY_FORM_LOAD_ERROR);
  await loading;
  expect(() => createGafaSdk(input, { useMockClient: true })).toThrow(pay.PAY_FORM_LOAD_ERROR);
  expect(() => pay.setGafaPayEnvironment("production")).toThrow(pay.PAY_FORM_LOAD_ERROR);
  expect(pay.resolveGafaPayApiUrl()).toBe(BUQ_ENVIRONMENTS.staging.gafaPayApiUrl);
  expect(pay.resolveStripePaymentScriptUrl()).toBe(BUQ_ENVIRONMENTS.staging.stripePaymentScriptUrl);
});

it.each(["stripe", "frontpay"])("bloquea producción si %s se precargó fuera del bridge", (provider) => {
  const sdk = createGafaSdk({ ...input, environment: "staging" }, { useMockClient: true });
  sdk.unmountAll();
  if (provider === "frontpay") window.GafaPayElements = {};
  else vi.spyOn(customElements, "get").mockReturnValue(class extends HTMLElement {});
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(() => createGafaSdk(input, { useMockClient: true })).toThrow(pay.PAY_FORM_LOAD_ERROR);
  expect(pay.resolveGafaPayApiUrl()).toBe(BUQ_ENVIRONMENTS.staging.gafaPayApiUrl);
});
