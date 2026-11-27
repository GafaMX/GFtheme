import bundle from "./__fixtures__/frontpay-staging.main.js?raw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BUQ_ENVIRONMENTS } from "../config/buqEnvironments";

const env = BUQ_ENVIRONMENTS.staging;
let pay: typeof import("./gafaPay");
const credentials = { clientId: "test-client", clientSecret: "test-only", method: "recurrente" };

beforeEach(async () => {
  vi.resetModules();
  pay = await import("./gafaPay");
  pay.setGafaPayEnvironment("staging");
  pay.setGafaPayFrontUrl(env.gafaPayFrontUrl);
  pay.setGafaPayApiUrl(env.gafaPayApiUrl);
  pay.setStripePaymentScriptUrl(env.stripePaymentScriptUrl);
  window.React = { version: "16.8.6", createElement: vi.fn() };
  window.ReactDOM = { render: vi.fn(), unmountComponentAtNode: vi.fn() };
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  localStorage.clear();
  delete window.React;
  delete window.ReactDOM;
  delete window.GafaPayElements;
  delete window.GAFAPAY_API_URL;
});

function interceptBundle() {
  const requests: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    requests.push(url);
    return { status: 200, json: async () => url.endsWith("/oauth/token")
      ? [{ access_token: "test-token" }] : [] } as Response;
  });
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    append(node);
    if ((node as HTMLScriptElement).src) {
      expect((node as HTMLScriptElement).src).toBe(env.gafaPayFrontUrl);
      // Evaluación íntegra del UMD real; ninguna implementación del proveedor simulada.
      window.eval(bundle);
      node.dispatchEvent(new Event("load"));
    }
    return node;
  });
  return requests;
}

it("el bundle real autentica y consulta métodos contra la API validada", async () => {
  const requests = interceptBundle();
  const runtime = await pay.loadGafaPay(credentials);
  await vi.waitFor(() => expect(requests).toHaveLength(2));
  expect(runtime.elements.RecurrentePayment).toBeTypeOf("function");
  expect(requests).toEqual([`${env.gafaPayApiUrl}/api/oauth/token`, `${env.gafaPayApiUrl}/api/brand.getpaymentsystems`]);
});

it("el bundle real ignora global y JSON de API: su endpoint es compilado", async () => {
  const override = "https://payments-override.example.test";
  window.GAFAPAY_API_URL = override;
  const config = document.createElement("script");
  config.setAttribute("data-gafapay-config", "");
  config.type = "application/json";
  config.textContent = JSON.stringify({ CLIENT_ID: credentials.clientId, CLIENT_SECRET: credentials.clientSecret, GAFAPAY_API_URL: override });
  document.head.appendChild(config);
  const requests = interceptBundle();
  window.eval(bundle);
  await vi.waitFor(() => expect(requests).toHaveLength(2));
  expect(requests).toEqual([`${env.gafaPayApiUrl}/api/oauth/token`, `${env.gafaPayApiUrl}/api/brand.getpaymentsystems`]);
});

it.each(["config", "global", "call"])("rechaza un override incompatible (%s) antes de evaluar el bundle real", async (source) => {
  const override = "https://payments-override.example.test";
  if (source === "config") pay.setGafaPayApiUrl(override, { configureLegacy: true });
  if (source === "global") { pay.setGafaPayApiUrl(); window.GAFAPAY_API_URL = override; }
  const requests = interceptBundle();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await expect(pay.loadGafaPay({ ...credentials, ...(source === "call" ? { apiUrl: override } : {}) }))
    .rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
  expect(requests).toEqual([]);
  expect(document.querySelector("script[src]")).toBeNull();
  expect(document.querySelector("[data-gafapay-config]")).toBeNull();
});

it("rechaza la API incompatible antes de cobrar con Stripe y necesitar frontpay para matrícula", async () => {
  pay.setGafaPayApiUrl("https://payments-override.example.test");
  const requests = interceptBundle();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  await expect(pay.loadGafaPay({ ...credentials, method: "stripe" })).rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
  expect(requests).toEqual([]);
  expect(document.querySelector("script[src]")).toBeNull();
});
