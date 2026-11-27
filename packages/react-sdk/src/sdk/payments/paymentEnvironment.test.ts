import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUQ_ENVIRONMENTS, type BuqEnvironmentId } from "../config/buqEnvironments";

let pay: typeof import("./gafaPay");
function configure(environment: BuqEnvironmentId = "staging") {
  const env = BUQ_ENVIRONMENTS[environment];
  pay.setGafaPayEnvironment(environment);
  pay.setGafaPayFrontUrl(env.gafaPayFrontUrl);
  pay.setGafaPayApiUrl(environment === "production" ? undefined : env.gafaPayApiUrl);
  pay.setStripePaymentScriptUrl(environment === "production" ? undefined : env.stripePaymentScriptUrl);
}
const credentials = { clientId: "test-client", clientSecret: "test-only" };
const props = {
  order: { customerName: "Test", lineItems: [] }, generalData: {},
  onStartPayAction: vi.fn(), onGafaPaySuccessAction: vi.fn(), onGafaPayErrAction: vi.fn(),
};

// Bundles simulados: ningún script externo ni cobro sale del proceso de tests.
function mockPaymentBundles() {
  let stripeDefined = false;
  const scripts: string[] = [];
  const createElement = vi.fn((component, widgetProps) => ({ component, props: widgetProps }));
  const render = vi.fn();
  window.React = { version: "16.8.6", createElement };
  window.ReactDOM = { render, unmountComponentAtNode: vi.fn() };
  vi.spyOn(customElements, "get").mockImplementation(() => stripeDefined ? class extends HTMLElement {} : undefined);
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    append(node);
    const script = node as HTMLScriptElement;
    if (script.src) {
      scripts.push(script.src);
      if (script.src.includes("stripe")) stripeDefined = true;
      else window.GafaPayElements = { RecurrentePayment: vi.fn(), StripePayment: vi.fn() };
      script.dispatchEvent(new Event("load"));
    }
    return node;
  });
  return { scripts, createElement, render };
}

beforeEach(async () => {
  vi.resetModules();
  pay = await import("./gafaPay");
  document.head.innerHTML = "";
  delete window.GafaPayElements;
  delete window.GAFAPAY_API_URL;
  configure();
});
afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = "";
  delete window.React;
  delete window.ReactDOM;
  delete window.GafaPayElements;
  delete window.GAFAPAY_API_URL;
  delete window._handleStripePayment;
});

describe("aislamiento de pagos por entorno", () => {
  it.each([false, true])("cambia entre Stripe y Recurrente con override de script (frontpay primero=%s)", async (frontpayFirst) => {
    const { scripts, render } = mockPaymentBundles();
    const stripeScript = frontpayFirst ? BUQ_ENVIRONMENTS.staging.stripePaymentScriptUrl : "https://alternate.example.test/stripe.js";
    const frontScript = frontpayFirst ? "https://alternate.example.test/frontpay.js" : BUQ_ENVIRONMENTS.staging.gafaPayFrontUrl;
    const stripeCredentials = { ...credentials, method: "stripe", ...(frontpayFirst ? {} : { scriptUrl: stripeScript }) };
    const frontCredentials = { ...credentials, method: "recurrente", ...(frontpayFirst ? { scriptUrl: frontScript } : {}) };
    const first = await pay.loadGafaPay(frontpayFirst ? frontCredentials : stripeCredentials);
    const second = await pay.loadGafaPay(frontpayFirst ? stripeCredentials : frontCredentials);
    const stripe = frontpayFirst ? second : first;
    const front = frontpayFirst ? first : second;
    const stripeBox = document.createElement("div");
    const stripeIsland = pay.mountGafaPayWidget(stripe, stripeBox, "stripe", props);
    const frontIsland = pay.mountGafaPayWidget(front, document.createElement("div"), "recurrente", props);
    stripeIsland.update(props);
    frontIsland.update(props);
    expect(stripeBox.firstElementChild?.getAttribute("api-url")?.replace(/\/\.gafa-checkout-widget-\d+$/, "")).toBe(BUQ_ENVIRONMENTS.staging.gafaPayApiUrl);
    expect(render).toHaveBeenCalledTimes(2);
    expect(scripts).toEqual(frontpayFirst ? [frontScript, stripeScript] : [stripeScript, frontScript]);
    expect(await pay.loadGafaPay(stripeCredentials)).toBe(stripe);
    expect(await pay.loadGafaPay(frontCredentials)).toBe(front);
    expect(scripts).toHaveLength(2);
    stripeIsland.unmount();
    frontIsland.unmount();
  });

  it("permite cargas simultáneas por proveedor con scripts alternativos y la misma API", async () => {
    const { scripts } = mockPaymentBundles();
    const runtimes = await Promise.all([
      pay.loadGafaPay({ ...credentials, method: "stripe", scriptUrl: "https://alternate.example.test/stripe.js" }),
      pay.loadGafaPay({ ...credentials, method: "recurrente", scriptUrl: "https://alternate.example.test/frontpay.js" }),
    ]);
    expect(runtimes).toHaveLength(2);
    expect(scripts).toHaveLength(2);
  });

  it.each(["stripe", "recurrente"])("rechaza cambiar el script efectivo de %s aunque sea seguro", async (method) => {
    const { scripts } = mockPaymentBundles();
    const scriptUrl = `https://alternate.example.test/${method}.js`;
    await pay.loadGafaPay({ ...credentials, method, scriptUrl });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(pay.loadGafaPay({ ...credentials, method, scriptUrl: `https://another.example.test/${method}.js` }))
      .rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
    expect(scripts).toEqual([scriptUrl]);
  });

  it.each([false, true])("mantiene la API compartida al cambiar de proveedor (API global=%s)", async (globalApi) => {
    const { scripts } = mockPaymentBundles();
    // Proveedor alternativo simulado con contrato de API configurable; el bundle
    // real de staging rechaza estas APIs (frontpayBundleContract.test.ts).
    pay.setGafaPayFrontUrl("https://alternate.example.test/frontpay.js");
    if (globalApi) {
      pay.setGafaPayApiUrl();
      window.GAFAPAY_API_URL = BUQ_ENVIRONMENTS.staging.gafaPayApiUrl;
    }
    const apiUrl = "https://alternate-api.example.test";
    const stripe = await pay.loadGafaPay({ ...credentials, method: "stripe", apiUrl, scriptUrl: "https://alternate.example.test/stripe.js" });
    const stripeBox = document.createElement("div");
    const island = pay.mountGafaPayWidget(stripe, stripeBox, "stripe", props);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(pay.loadGafaPay({ ...credentials, method: "recurrente" })).rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
    expect(scripts).toHaveLength(1);
    await pay.loadGafaPay({ ...credentials, method: "recurrente", apiUrl });
    expect(scripts).toHaveLength(2);
    expect(window.GAFAPAY_API_URL).toBe(apiUrl);
    island.update(props);
    expect(stripeBox.firstElementChild?.getAttribute("api-url")?.replace(/\/\.gafa-checkout-widget-\d+$/, "")).toBe(apiUrl);
    island.unmount();
  });

  it("matrícula usa frontpay después de Stripe con script alternativo", async () => {
    const { scripts, render, createElement } = mockPaymentBundles();
    const stripeScript = "https://alternate.example.test/stripe.js";
    const stripe = await pay.loadGafaPay({ ...credentials, method: "stripe", scriptUrl: stripeScript });
    const stripeIsland = pay.mountGafaPayWidget(stripe, document.createElement("div"), "stripe", props);
    const success = { message: "simulated-enrollment-payment" };
    const savedCardClick = vi.fn();
    render.mockImplementation((element, container) => {
      const button = document.createElement("button");
      button.setAttribute("data-saved-card", "");
      button.addEventListener("click", savedCardClick);
      container.replaceChildren(button);
      window._handleStripePayment = vi.fn(() => element.props.onGafaPaySuccessAction(success));
    });
    const { chargeEnrollmentWithSavedCard } = await import("./enrollmentCharge");
    await expect(chargeEnrollmentWithSavedCard({
      order: props.order, generalData: props.generalData, credentials,
    })).resolves.toEqual(success);
    expect(scripts).toEqual([stripeScript, BUQ_ENVIRONMENTS.staging.gafaPayFrontUrl]);
    expect(createElement).toHaveBeenCalledWith(window.GafaPayElements!.StripePayment,
      expect.objectContaining({ apiUrl: BUQ_ENVIRONMENTS.staging.gafaPayApiUrl }));
    expect(savedCardClick).toHaveBeenCalledOnce();
    expect(window._handleStripePayment).toHaveBeenCalledOnce();
    expect(document.querySelector("[data-gafa-enrollment-charge]")).toBeNull();
    stripeIsland.update(props);
    stripeIsland.unmount();
  });

  const setters = ["setGafaPayFrontUrl", "setGafaPayApiUrl", "setStripePaymentScriptUrl"] as const;
  const hosts = ["frontpay.buq.partners", "apipay.buq.partners", "gafapay-api.azurewebsites.net", "gafapay-front.azurewebsites.net", "buq.partners", "gafa.fit", "api.gafa.fit", "GAFA.FIT."];
  for (const environment of ["staging", "development"] as const) {
    for (const setter of setters) {
      for (const host of hosts) {
        it(`${environment}: ${setter} rechaza ${host} antes de cargar ambos proveedores`, async () => {
          // Development solo puede pagar con overrides seguros de las tres URLs.
          configure();
          pay.setGafaPayEnvironment(environment);
          pay[setter](`https://${host}/payment.js`);
          const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
          const append = vi.spyOn(document.head, "appendChild");
          expect(() => pay.assertSafePaymentUrls()).toThrow(pay.PAY_FORM_LOAD_ERROR);
          for (const method of ["stripe", "paypal"]) {
            await expect(pay.loadGafaPay({ ...credentials, method })).rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
          }
          expect(append).not.toHaveBeenCalled();
          expect(error).toHaveBeenCalledWith(expect.stringContaining(host.toLowerCase()));
          expect(window.GAFAPAY_API_URL).toBeUndefined();
        });
      }
    }
  }

  it.each(["staging", "development"] as const)("%s compara hostname completo y acepta dominios parecidos seguros", (environment) => {
    pay.setGafaPayEnvironment(environment);
    expect(() => pay.assertSafePaymentUrls({
      frontUrl: "https://gafa.fit.example.test/front.js",
      apiUrl: "https://notbuq.partners",
      stripeScriptUrl: "https://buq.partners.example.test/stripe.js",
    })).not.toThrow();
  });

  it.each([
    { method: "paypal", globalApi: false }, { method: "paypal", globalApi: true },
    { method: "stripe", globalApi: false }, { method: "stripe", globalApi: true },
  ])("carga, monta y actualiza con overrides seguros por llamada: %j", async ({ method, globalApi }) => {
    if (globalApi) {
      pay.setGafaPayApiUrl();
      window.GAFAPAY_API_URL = BUQ_ENVIRONMENTS.staging.gafaPayApiUrl;
    }
    const apiUrl = "https://another-api.example.test";
    const scriptUrl = "https://another-front.example.test/widget.js";
    if (method === "stripe") pay.setGafaPayFrontUrl("https://alternate.example.test/frontpay.js");
    let defined = false;
    vi.spyOn(customElements, "get").mockImplementation(() => defined ? class extends HTMLElement {} : undefined);
    const createElement = vi.fn();
    const render = vi.fn();
    window.React = { version: "16.8.6", createElement };
    window.ReactDOM = { render, unmountComponentAtNode: vi.fn() };
    const append = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      append(node);
      const script = node as HTMLScriptElement;
      if (script.src) {
        expect(script.src).toBe(scriptUrl);
        if (method === "stripe") defined = true;
        else window.GafaPayElements = { PaypalPayment: vi.fn() };
        script.dispatchEvent(new Event("load"));
      }
      return node;
    });
    const runtime = await pay.loadGafaPay({ ...credentials, method, scriptUrl, apiUrl });
    const box = document.createElement("div");
    const island = pay.mountGafaPayWidget(runtime, box, method, props);
    island.update({ ...props, order: { ...props.order, customerName: "Updated" } });
    if (method === "stripe") expect(box.firstElementChild?.getAttribute("api-url")?.replace(/\/\.gafa-checkout-widget-\d+$/, "")).toBe(apiUrl);
    else expect(render).toHaveBeenCalledTimes(2);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => island.update({ ...props, apiUrl: "https://gafa.fit/" })).toThrow(pay.PAY_FORM_LOAD_ERROR);
    pay.setGafaPayApiUrl("https://changed-api.example.test");
    expect(() => island.update(props)).toThrow(pay.PAY_FORM_LOAD_ERROR);
    if (method === "stripe") expect(box.firstElementChild?.getAttribute("api-url")?.replace(/\/\.gafa-checkout-widget-\d+$/, "")).toBe(apiUrl);
    else expect(render).toHaveBeenCalledTimes(2);
    island.unmount();
  });

  it("development histórico queda bloqueado", async () => {
    configure("development");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(pay.loadGafaPay({ ...credentials, method: "stripe" })).rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
  });

  it("acepta los tres hosts de staging y overrides seguros en development", () => {
    expect(() => pay.assertSafePaymentUrls()).not.toThrow();
    pay.setGafaPayEnvironment("development");
    expect(() => pay.assertSafePaymentUrls()).not.toThrow();
  });

  it.each(["https://BUQ.PARTNERS./x", "https://sub.buq.partners/x", "/relative.js", "javascript:alert(1)"])(
    "bloquea variantes inseguras: %s", (url) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      expect(() => pay.assertSafePaymentUrls({ stripeScriptUrl: url })).toThrow(pay.PAY_FORM_LOAD_ERROR);
    },
  );

  it("valida overrides por llamada y props antes de montar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(pay.loadGafaPay({ ...credentials, method: "stripe", scriptUrl: "https://buq.partners/stripe.js" }))
      .rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
    await expect(pay.loadGafaPay({ ...credentials, apiUrl: "https://apipay.buq.partners" }))
      .rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
    const box = document.createElement("div");
    const runtime = { React: { createElement: vi.fn() }, ReactDOM: { render: vi.fn(), unmountComponentAtNode: vi.fn() }, elements: {} };
    expect(() => pay.mountGafaPayWidget(runtime, box, "stripe", { ...props, apiUrl: "https://apipay.buq.partners" }))
      .toThrow(pay.PAY_FORM_LOAD_ERROR);
    expect(box.children).toHaveLength(0);
  });

  it("carga el IIFE de staging y entrega api-url al componente, también al actualizar", async () => {
    let defined = false;
    vi.spyOn(customElements, "get").mockImplementation(() => defined ? class extends HTMLElement {} : undefined);
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      expect(script.src).toBe(BUQ_ENVIRONMENTS.staging.stripePaymentScriptUrl);
      defined = true;
      script.dispatchEvent(new Event("load"));
      return node;
    });
    const runtime = await pay.loadGafaPay({ ...credentials, method: "stripe" });
    const box = document.createElement("div");
    const island = pay.mountGafaPayWidget(runtime, box, "stripe", props);
    expect(box.firstElementChild?.getAttribute("api-url")?.replace(/\/\.gafa-checkout-widget-\d+$/, "")).toBe(BUQ_ENVIRONMENTS.staging.gafaPayApiUrl);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => island.update({ ...props, apiUrl: "https://apipay.buq.partners" })).toThrow(pay.PAY_FORM_LOAD_ERROR);
    expect(box.firstElementChild?.getAttribute("api-url")?.replace(/\/\.gafa-checkout-widget-\d+$/, "")).toBe(BUQ_ENVIRONMENTS.staging.gafaPayApiUrl);
    // Una promesa cacheada nunca evita la guarda.
    pay.setStripePaymentScriptUrl("https://buq.partners/stripe.js");
    await expect(pay.loadGafaPay({ ...credentials, method: "stripe" })).rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
    island.unmount();
  });

  it.each([false, true])("frontpay recibe API de staging antes de evaluar su JS (config existente=%s)", async (existing) => {
    window.React = { version: "16.8.6", createElement: vi.fn() };
    window.ReactDOM = { render: vi.fn(), unmountComponentAtNode: vi.fn() };
    if (existing) {
      const script = document.createElement("script");
      script.type = "application/json";
      script.setAttribute("data-gafapay-config", "");
      script.textContent = JSON.stringify({ CLIENT_ID: "page-client", CLIENT_SECRET: "page-test", GAFAPAY_API_URL: "https://apipay.buq.partners" });
      document.head.appendChild(script);
    }
    const append = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      append(node);
      const script = node as HTMLScriptElement;
      if (script.src) {
        expect(script.src).toBe(BUQ_ENVIRONMENTS.staging.gafaPayFrontUrl);
        expect(window.GAFAPAY_API_URL).toBe(BUQ_ENVIRONMENTS.staging.gafaPayApiUrl);
        const config = JSON.parse(document.querySelector("[data-gafapay-config]")!.textContent!);
        expect(config.GAFAPAY_API_URL).toBe(BUQ_ENVIRONMENTS.staging.gafaPayApiUrl);
        expect(config.CLIENT_ID).toBe(existing ? "page-client" : credentials.clientId);
        window.GafaPayElements = { PaypalPayment: vi.fn() };
        script.dispatchEvent(new Event("load"));
      }
      return node;
    });
    await pay.loadGafaPay({ ...credentials, method: "paypal" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    pay.setGafaPayApiUrl("https://another.test");
    await expect(pay.loadGafaPay({ ...credentials, method: "paypal" })).rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
  });

  it("rechaza proveedores precargados de origen desconocido", async () => {
    window.GafaPayElements = { PaypalPayment: vi.fn() };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(pay.loadGafaPay(credentials)).rejects.toThrow(pay.PAY_FORM_LOAD_ERROR);
  });

  it.each([
    { manual: false, explicit: false, globalApi: false },
    { manual: false, explicit: false, globalApi: true },
    { manual: true, explicit: false, globalApi: false },
    { manual: true, explicit: false, globalApi: true },
    { manual: false, explicit: true, globalApi: true },
  ])("producción conserva global/JSON históricos salvo opción nueva de página: %j", async ({ manual, explicit, globalApi }) => {
    configure("production");
    if (globalApi) window.GAFAPAY_API_URL = "https://global-api.example.test/";
    if (manual) pay.setGafaPayApiUrl("https://manual.example.test");
    const { createGafaSdk } = await import("../runtime");
    const sdk = createGafaSdk({ companyId: 1, analyticsEnabled: false,
      ...(explicit ? { gafaPayApiUrl: "https://custom.example.test" } : {}),
    }, { useMockClient: true });
    window.React = { version: "16.8.6", createElement: vi.fn() };
    window.ReactDOM = { render: vi.fn(), unmountComponentAtNode: vi.fn() };
    const append = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      append(node);
      const script = node as HTMLScriptElement;
      if (script.src) {
        expect(script.src).toBe("https://frontpay.buq.partners/main.js");
        const config = JSON.parse(document.querySelector("[data-gafapay-config]")!.textContent!);
        if (explicit) {
          expect(config.GAFAPAY_API_URL).toBe("https://custom.example.test");
          expect(window.GAFAPAY_API_URL).toBe("https://custom.example.test");
        } else {
          expect(config).toEqual({ CLIENT_ID: credentials.clientId, CLIENT_SECRET: credentials.clientSecret });
          expect(window.GAFAPAY_API_URL).toBe(globalApi ? "https://global-api.example.test/" : undefined);
        }
        window.GafaPayElements = {};
        script.dispatchEvent(new Event("load"));
      }
      return node;
    });
    try {
      await pay.loadGafaPay(credentials);
      expect(pay.resolveGafaPayApiUrl()).toBe(explicit ? "https://custom.example.test" :
        manual ? "https://manual.example.test" : globalApi ? "https://global-api.example.test" : pay.DEFAULT_GAFAPAY_API_URL);
    } finally {
      sdk.unmountAll();
    }
  });

  it.each([false, true])("producción: setter y API por llamada no alteran JSON legacy existente=%s", async (existing) => {
    configure("production");
    pay.setGafaPayApiUrl("https://manual.example.test");
    window.GAFAPAY_API_URL = "https://global-api.example.test/";
    window.React = { version: "16.8.6", createElement: vi.fn() };
    window.ReactDOM = { render: vi.fn(), unmountComponentAtNode: vi.fn() };
    const pageJson = '{ "CLIENT_ID": "page-client", "CLIENT_SECRET": "page-test", "GAFAPAY_API_URL": "https://page-api.example.test/" }';
    if (existing) {
      const script = document.createElement("script");
      script.type = "application/json";
      script.setAttribute("data-gafapay-config", "");
      script.textContent = pageJson;
      document.head.appendChild(script);
    }
    const append = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      append(node);
      const script = node as HTMLScriptElement;
      if (script.src) {
        expect(window.GAFAPAY_API_URL).toBe("https://global-api.example.test/");
        const json = document.querySelector("[data-gafapay-config]")!.textContent!;
        if (existing) expect(json).toBe(pageJson);
        else expect(JSON.parse(json)).toEqual({ CLIENT_ID: credentials.clientId, CLIENT_SECRET: credentials.clientSecret });
        window.GafaPayElements = { RecurrentePayment: vi.fn() };
        script.dispatchEvent(new Event("load"));
      }
      return node;
    });
    await pay.loadGafaPay({ ...credentials, method: "recurrente", apiUrl: "https://call-api.example.test" });
  });

  it("producción conserva exactamente las URLs históricas", () => {
    configure("production");
    expect(pay.resolveGafaPayFrontUrl()).toBe("https://frontpay.buq.partners/main.js");
    expect(pay.resolveGafaPayApiUrl()).toBe("https://apipay.buq.partners");
    expect(pay.resolveStripePaymentScriptUrl()).toBe("https://buq.partners/js/payments/stripe-payment.iife.js");
    expect(() => pay.assertSafePaymentUrls()).not.toThrow();
  });
});
