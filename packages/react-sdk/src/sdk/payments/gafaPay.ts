import { BUQ_ENVIRONMENTS, nonProductionUrlError, type BuqEnvironmentId } from "../config/buqEnvironments";
import { hasStripeSession, installStripeSessionFetchGuard, registerStripeSession } from "./stripeSessionGuard";

/**
 * Bridge de pagos.
 *
 * Stripe (desde 2026-11-26) usa el web component `<stripe-payment-element>`
 * de `https://buq.partners/js/payments/stripe-payment.iife.js` — el mismo
 * widget que gafa.fit. Habla con GAFApay (`apipay.buq.partners`) y confirma
 * una Checkout Session (`ui_mode=elements`, `client_secret` cs_…).
 *
 * PayPal / Recurrente / Conekta siguen en GafaPayFront
 * (`frontpay.buq.partners/main.js`). Ese bundle trae su PROPIO React 16.8.6;
 * React 19 los rechaza ("A React Element from an older version of React was
 * rendered", error #525). Por eso se montan como isla, con un ReactDOM 16
 * aparte, en un div que nuestro React reserva pero no toca.
 *
 * El bundle de frontpay exige su configuracion en el DOM ANTES de evaluarse:
 *
 *   <script data-gafapay-config type="application/json">
 *     { "CLIENT_ID": 282, "CLIENT_SECRET": "..." }
 *   </script>
 *
 * Esas credenciales son `gafapay_client_id` / `gafapay_client_secret` de la
 * marca (mismo contrato que usa el fancy v1).
 */

export type GafaPayLineItem = {
  name: string;
  unitPrice: number;
  quantity: number;
  product_type: string;
  product_id: number;
  height: number;
  length: number;
  weight: number;
  width: number;
  /** gafa.fit: `${type}--${id}` — metadata de la Checkout Session. */
  site_id?: string;
  /** `membership` marca la línea como subscribable en GAFApay. */
  type?: string;
  /** Precio ya descontado (gafa.fit manda unitPrice lleno + totalPrice). */
  totalPrice?: number;
};

export type GafaPayOrder = {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  lineItems: GafaPayLineItem[];
  /** ISO 4217. Recurrente lo manda al crear el checkout (GTQ, EUR, MXN). */
  currency?: string;
};

export type GafaPayGeneralData = {
  companiesId?: number;
  locationsId?: number;
  adminProfilesId?: number | null;
  usersProfilesId?: number;
  usersId?: number;
};

/**
 * Lo que GafaPayFront entrega al confirmar. El cobro ya ocurrió: lo hace el
 * navegador contra `gafapay-api` (`stripe.process.clientpaymentbycard`).
 * El fancy v1 guarda `e.message` en `payment_data` y lo manda a `/reservate`
 * (paymentByCard / paymentByToken). Recortarlo deja la compra sin créditos.
 */
export type GafaPaySuccess = {
  message: unknown;
  subscriptionId?: string | number | null;
  recurringPayment?: boolean;
  webToken?: string;
};

export type GafaPayWidgetProps = {
  order: GafaPayOrder;
  generalData: GafaPayGeneralData;
  /**
   * GafaPayFront.StripePayment.handleSubmit (y Conekta) llaman esto SIN `?.`
   * al confirmar. Si falta, el throw queda como unhandled rejection: no hay
   * cobro, ni callback de éxito/error, y el checkout se queda en "Procesando…".
   */
  onStartPayAction: () => void;
  onGafaPaySuccessAction: (result: GafaPaySuccess) => void;
  onGafaPayErrAction: (error: { err?: unknown; message?: string }) => void;
  /**
   * Recurrente: el cobro pasa en otra ventana. GafaPayFront llama esto con
   * `{ redirect, checkout_token|id }` en cuanto tiene la URL.
   * Stripe (widget nuevo): `initial-payment-created` con `{ message }` =
   * checkout_token. En ambos hay que POSTear `initial-purchase` y pollar.
   */
  onCheckoutOpenAction?: (data: unknown, done?: () => void) => void;
  onCheckoutCloseAction?: () => void;
  /** Stripe: `initial-payment-updated` (p. ej. cambió el token). */
  onInitialPaymentUpdated?: (data: unknown) => void;
  /** Stripe: `initial-payment-updating` — pausar el poll. */
  onInitialPaymentUpdating?: () => void;
  /** Stripe: `initial-payment-update-error`. */
  onInitialPaymentUpdateError?: (error: { err?: unknown; message?: string }) => void;
  termsAndConditions?: string | boolean | null;
  hasRecurringPayment?: boolean;
  paymentFrequency?: string | null;
  changePaymentSystemProperties?: (props: { recurringPayment?: boolean; saveCard?: boolean }) => void;
  /** API de GAFApay (`api-url` del web component). */
  apiUrl?: string;
  clientId?: string | number;
  clientSecret?: string;
  customerFirstName?: string;
  customerLastName?: string;
  discountAmount?: number;
};

type ReactLike = {
  version?: string;
  createElement: (type: unknown, props?: unknown) => unknown;
};

type ReactDomLike = {
  render: (element: unknown, container: Element) => void;
  unmountComponentAtNode: (container: Element) => boolean;
};

type GafaPayElementsGlobal = Record<string, unknown>;

declare global {
  interface Window {
    GafaPayElements?: GafaPayElementsGlobal;
    GAFAPAY_SDK_URL?: string;
    GAFAPAY_API_URL?: string;
    React?: ReactLike;
    ReactDOM?: ReactDomLike;
    _handleStripePayment?: () => unknown;
    _handleConektaPayment?: () => unknown;
    _handleRecurrentePayment?: () => unknown;
  }
}

export const DEFAULT_GAFAPAY_FRONT_URL = "https://frontpay.buq.partners/main.js";
export const DEFAULT_GAFAPAY_API_URL = "https://apipay.buq.partners";
export const DEFAULT_STRIPE_PAYMENT_SCRIPT_URL = "https://buq.partners/js/payments/stripe-payment.iife.js";
export const STRIPE_PAYMENT_ELEMENT_TAG = "stripe-payment-element";
export const PAY_FORM_LOAD_ERROR = "No se pudo cargar el formulario de pago. Inténtalo de nuevo.";
export const WIDGET_CONTENT_TIMEOUT_MS = 9000;
export const WIDGET_CONTENT_TIMEOUT_MOBILE_MS = 16000;
const MOBILE_VIEWPORT_MAX = 768;

/** En móvil GafaPay + Stripe.js suelen tardar más (4G, unpkg, js.stripe.com). */
export function widgetContentTimeoutMs(
  width = typeof window !== "undefined" ? window.innerWidth : WIDGET_CONTENT_TIMEOUT_MS,
): number {
  return width <= MOBILE_VIEWPORT_MAX ? WIDGET_CONTENT_TIMEOUT_MOBILE_MS : WIDGET_CONTENT_TIMEOUT_MS;
}

const REACT16_SOURCES = [
  {
    react: "https://unpkg.com/react@16.8.6/umd/react.production.min.js",
    reactDom: "https://unpkg.com/react-dom@16.8.6/umd/react-dom.production.min.js",
  },
  {
    react: "https://cdn.jsdelivr.net/npm/react@16.8.6/umd/react.production.min.js",
    reactDom: "https://cdn.jsdelivr.net/npm/react-dom@16.8.6/umd/react-dom.production.min.js",
  },
] as const;
/** API clasica que GafaPayFront.PaypalPayment llama (`paypal.Button.render`). */
const PAYPAL_CHECKOUT_JS = "https://www.paypalobjects.com/api/checkout.min.js";

let configuredFrontUrl: string | undefined;
let configuredApiUrl: string | undefined;
let configureLegacyApiFromConfig = false;
let configuredStripeScriptUrl: string | undefined;
// La configuración del SDK es reemplazable; los setters manuales son históricos
// y deben volver a ser efectivos cuando producción no especifica overrides.
let sdkApiUrl: string | undefined;
let sdkStripeScriptUrl: string | undefined;
let configuredEnvironment: BuqEnvironmentId = "production";
// Los proveedores tienen estado global y customElements no permite redefinir el IIFE.
// Cambiar de endpoints después de cargar un proveedor exige recargar la página.
type PaymentProvider = "stripe" | "frontpay";
const loadedPaymentConfigurations: Partial<Record<PaymentProvider, PaymentContext>> = {};

export function setGafaPayEnvironment(environment: BuqEnvironmentId): void {
  const unknownProvider = configuredEnvironment !== environment && typeof window !== "undefined" &&
    (window.GafaPayElements || stripeElementDefined());
  if (unknownProvider || Object.values(loadedPaymentConfigurations).some((loaded) => loaded.environment !== environment)) {
    paymentLoadBlocked("los proveedores ya se cargaron con otro entorno; recarga la página");
  }
  configuredEnvironment = environment;
}

/** Aplicar antes de configurar clientes o almacenamiento: el cambio puede bloquearse. */
export function configureGafaPayForSdk(config: {
  environment: BuqEnvironmentId;
  gafaPayApiUrl?: string;
  stripePaymentScriptUrl?: string;
}): void {
  setGafaPayEnvironment(config.environment);
  sdkApiUrl = config.gafaPayApiUrl;
  sdkStripeScriptUrl = config.stripePaymentScriptUrl;
}

function paymentLoadBlocked(reason: string): never {
  console.error(`[gafa-sdk] Pago bloqueado (${configuredEnvironment}): ${reason}`);
  throw new Error(PAY_FORM_LOAD_ERROR);
}

type PaymentUrls = { frontUrl: string; apiUrl: string; stripeScriptUrl: string };

function resolvePaymentUrls(overrides?: Partial<PaymentUrls>): PaymentUrls {
  return {
    frontUrl: resolveGafaPayFrontUrl(overrides?.frontUrl),
    apiUrl: resolveGafaPayApiUrl(overrides?.apiUrl),
    stripeScriptUrl: resolveStripePaymentScriptUrl(overrides?.stripeScriptUrl),
  };
}

/** Fail closed antes de scripts, cachés, globales o montaje del proveedor. */
export function assertSafePaymentUrls(overrides?: Partial<PaymentUrls>): void {
  if (configuredEnvironment === "production") return;
  const urls = {
    GAFAPAY_FRONT_URL: resolveGafaPayFrontUrl(overrides?.frontUrl),
    GAFAPAY_API_URL: resolveGafaPayApiUrl(overrides?.apiUrl),
    STRIPE_PAYMENT_SCRIPT_URL: resolveStripePaymentScriptUrl(overrides?.stripeScriptUrl),
  };
  for (const [key, value] of Object.entries(urls)) {
    const reason = nonProductionUrlError(value);
    if (reason) paymentLoadBlocked(`${key} ${reason}`);
  }
  // Este bundle tiene la API compilada; global/JSON/props no la cambian.
  // Validar también antes de Stripe: matrícula puede necesitar frontpay tras cobrar.
  const front = new URL(urls.GAFAPAY_FRONT_URL);
  const staging = BUQ_ENVIRONMENTS.staging;
  const stagingFront = new URL(staging.gafaPayFrontUrl);
  if (front.origin === stagingFront.origin && front.pathname === stagingFront.pathname &&
      urls.GAFAPAY_API_URL !== staging.gafaPayApiUrl) {
    paymentLoadBlocked("GAFAPAY_API_URL incompatible con la API compilada del bundle frontpay de staging");
  }
  for (const loaded of Object.values(loadedPaymentConfigurations)) {
    if (loaded.environment !== configuredEnvironment || loaded.urls.apiUrl !== urls.GAFAPAY_API_URL) {
      paymentLoadBlocked("los proveedores ya se cargaron con otro entorno o API; recarga la página");
    }
  }
}

function providerScriptUrl(urls: PaymentUrls, provider: PaymentProvider): string {
  return provider === "stripe" ? urls.stripeScriptUrl : urls.frontUrl;
}

function assertCompatibleProviderScript(urls: PaymentUrls, provider: PaymentProvider): void {
  if (configuredEnvironment === "production") return;
  const loaded = loadedPaymentConfigurations[provider];
  if (loaded && providerScriptUrl(loaded.urls, provider) !== providerScriptUrl(urls, provider)) {
    paymentLoadBlocked("el proveedor ya se cargó con otro script; recarga la página");
  }
}

type PaymentContext = {
  environment: BuqEnvironmentId;
  provider: PaymentProvider;
  urls: PaymentUrls;
  defaults: string;
};
const runtimeContexts = new WeakMap<Runtime, PaymentContext>();

function paymentConfigurationKey(urls: PaymentUrls, provider: PaymentProvider): string {
  return JSON.stringify([providerScriptUrl(urls, provider), urls.apiUrl]);
}

function publishLegacyApi(apiUrl: string): void {
  const previous = resolvePaymentUrls();
  window.GAFAPAY_API_URL = apiUrl;
  const current = resolvePaymentUrls();
  // Frontpay puede publicar una API por llamada que Stripe ya estaba usando.
  // Actualizar solo snapshots intactos: cambios externos siguen bloqueados.
  for (const context of Object.values(loadedPaymentConfigurations)) {
    if (context.urls.apiUrl === current.apiUrl &&
        context.defaults === paymentConfigurationKey(previous, context.provider)) {
      context.defaults = paymentConfigurationKey(current, context.provider);
    }
  }
}

/** Montaje y updates usan los endpoints efectivos de la carga, incluyendo overrides. */
function widgetPropsForRuntime(runtime: Runtime, props: GafaPayWidgetProps): GafaPayWidgetProps {
  if (configuredEnvironment === "production") return props;
  const context = runtimeContexts.get(runtime);
  if (!context || context.environment !== configuredEnvironment) {
    paymentLoadBlocked("el runtime no pertenece al entorno actual; recarga la página");
  }
  if (context.defaults !== paymentConfigurationKey(resolvePaymentUrls(), context.provider)) {
    paymentLoadBlocked("la configuración cambió después de cargar el proveedor; recarga la página");
  }
  const apiUrl = props.apiUrl || context.urls.apiUrl;
  assertSafePaymentUrls({ ...context.urls, apiUrl });
  assertCompatibleProviderScript(context.urls, context.provider);
  return { ...props, apiUrl };
}

/** Lo llama createGafaSdk con el front del entorno (production/staging/dev). */
export function setGafaPayFrontUrl(url?: string): void {
  configuredFrontUrl = url;
}

export function setGafaPayApiUrl(url?: string, options?: { configureLegacy?: boolean }): void {
  sdkApiUrl = undefined;
  configuredApiUrl = url;
  // El setter histórico solo afecta al resolver (y a Stripe). Únicamente las
  // nuevas opciones de config autorizan cambiar global/JSON de frontpay en prod.
  configureLegacyApiFromConfig = Boolean(url && options?.configureLegacy);
}

export function setStripePaymentScriptUrl(url?: string): void {
  sdkStripeScriptUrl = undefined;
  configuredStripeScriptUrl = url;
}

export function resolveGafaPayFrontUrl(override?: string): string {
  return override || configuredFrontUrl || (typeof window !== "undefined" ? window.GAFAPAY_SDK_URL : undefined) || DEFAULT_GAFAPAY_FRONT_URL;
}

export function resolveGafaPayApiUrl(override?: string): string {
  const raw =
    override ||
    sdkApiUrl ||
    configuredApiUrl ||
    (typeof window !== "undefined" ? window.GAFAPAY_API_URL : undefined) ||
    DEFAULT_GAFAPAY_API_URL;
  return raw.replace(/\/+$/, "");
}

export function resolveStripePaymentScriptUrl(override?: string): string {
  return override || sdkStripeScriptUrl || configuredStripeScriptUrl || DEFAULT_STRIPE_PAYMENT_SCRIPT_URL;
}

export type GafaPayCredentials = {
  clientId: string | number;
  clientSecret: string;
  scriptUrl?: string;
  apiUrl?: string;
  /** `stripe` carga el IIFE de `<stripe-payment-element>`, no frontpay. */
  method?: string;
};

type Runtime = {
  React: ReactLike;
  ReactDOM: ReactDomLike;
  elements: GafaPayElementsGlobal;
};

let runtimePromise: Promise<Runtime> | null = null;
let stripeRuntimePromise: Promise<Runtime> | null = null;

const STRIPE_RUNTIME: Runtime = {
  React: { createElement: () => null },
  ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true },
  elements: { StripePayment: STRIPE_PAYMENT_ELEMENT_TAG },
};

export function isStripePaymentMethod(slug: string | undefined): boolean {
  return (slug ?? "").trim().toLowerCase() === "stripe";
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-gafa-pay="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)));
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false; // el orden importa: config -> react -> frontpay
    script.dataset.gafaPay = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)));
    document.head.appendChild(script);
  });
}

function shouldConfigureLegacyApi(): boolean {
  // Producción conserva el contrato histórico salvo override explícito de API.
  return configuredEnvironment !== "production" || Boolean(sdkApiUrl) || configureLegacyApiFromConfig;
}

function ensureConfigElement(credentials: GafaPayCredentials): void {
  const existing = document.querySelector("[data-gafapay-config]");
  if (existing) {
    if (shouldConfigureLegacyApi()) {
      // Conservar credenciales de la página, pero nunca su API implícita de prod.
      const config = JSON.parse(existing.textContent || "{}");
      existing.textContent = JSON.stringify({ ...config, GAFAPAY_API_URL: resolveGafaPayApiUrl(credentials.apiUrl) });
    }
    return;
  }

  const script = document.createElement("script");
  script.type = "application/json";
  script.setAttribute("data-gafapay-config", "");
  // El bundle lee CLIENT_ID/CLIENT_SECRET al evaluarse; si falta, se queda sin
  // token y los metodos de pago nunca llegan ("debe completar las configuraciones").
  script.textContent = JSON.stringify({
    CLIENT_ID: Number(credentials.clientId) || credentials.clientId,
    CLIENT_SECRET: credentials.clientSecret,
    ...(shouldConfigureLegacyApi() ? { GAFAPAY_API_URL: resolveGafaPayApiUrl(credentials.apiUrl) } : {}),
  });
  document.head.appendChild(script);
}

function isReact16(candidate?: ReactLike): boolean {
  return Boolean(candidate?.version && candidate.version.startsWith("16"));
}

function readReact16(): { React: ReactLike; ReactDOM: ReactDomLike } | null {
  const react = window.React;
  const reactDom = window.ReactDOM;
  if (!isReact16(react) || !reactDom?.render) return null;
  return { React: react, ReactDOM: reactDom };
}

async function loadReact16(): Promise<{ React: ReactLike; ReactDOM: ReactDomLike }> {
  const already = readReact16();
  if (already) return already;

  let lastError: unknown;
  for (const source of REACT16_SOURCES) {
    try {
      await loadScript(source.react);
      await loadScript(source.reactDom);
      const loaded = readReact16();
      if (loaded) return loaded;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? new Error(PAY_FORM_LOAD_ERROR) : new Error(PAY_FORM_LOAD_ERROR);
}

export const PAYPAL_CTA_HIT_ID = "gafa-paypal-cta-hit";

export type PayPalButtonOptions = {
  payment?: (data: unknown, actions: unknown) => unknown;
  onAuthorize?: (...args: unknown[]) => unknown;
  onCancel?: (...args: unknown[]) => unknown;
  onError?: (error: unknown) => unknown;
  style?: Record<string, unknown>;
  [key: string]: unknown;
};

type PayPalCheckoutJs = {
  Button?: {
    render?: (options: PayPalButtonOptions, selector: string | Element) => unknown;
  };
  checkout?: {
    initXO?: () => void;
    startFlow?: (token: string) => void;
    closeXO?: () => void;
  };
};

function paypalGlobal(): PayPalCheckoutJs | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { paypal?: PayPalCheckoutJs }).paypal;
}

function hasLegacyPaypalButton(): boolean {
  return typeof paypalGlobal()?.Button?.render === "function";
}

let capturedPaypalOptions: PayPalButtonOptions | null = null;

function paymentIdFromResult(result: unknown): string | null {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (!result || typeof result !== "object") return null;
  const id = (result as { id?: unknown }).id;
  if (typeof id === "string" && id.trim()) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  return null;
}

/**
 * GafaPayFront pinta el botón oro en `#paypal` (centro). El CTA amarillo de
 * la derecha no puede hacer `.click()` al iframe de checkout.js: el gesto
 * no llega. Capturamos las options del `Button.render` para:
 * 1. clonar el botón encima del CTA (clic real al iframe), y
 * 2. abrir el checkout con `initXO` + `startFlow` si el socio pulsa el botón
 *    (teclado / si el overlay aún no montó).
 */
export function installPayPalButtonCapture(): () => void {
  const paypal = paypalGlobal();
  const button = paypal?.Button;
  const render = button?.render;
  if (!button || typeof render !== "function") return () => undefined;

  const original = render.bind(button);
  button.render = ((options: PayPalButtonOptions, selector: string | Element) => {
    capturedPaypalOptions = options;
    const first = original(options, selector);
    const hit = document.getElementById(PAYPAL_CTA_HIT_ID);
    if (
      hit &&
      selector !== hit &&
      selector !== `#${PAYPAL_CTA_HIT_ID}`
    ) {
      try {
        original(
          {
            ...options,
            style: {
              ...(options.style && typeof options.style === "object" ? options.style : {}),
              size: "responsive",
              shape: "rect",
              tagline: false,
            },
          },
          hit,
        );
      } catch {
        // Una sola instancia de checkout.js: el CTA usa initXO.
      }
    }
    return first;
  }) as typeof button.render;

  return () => {
    button.render = original;
    capturedPaypalOptions = null;
  };
}

export function triggerPayPalCheckout(root?: ParentNode | null): boolean {
  const paypal = paypalGlobal();
  const options = capturedPaypalOptions;
  const checkout = paypal?.checkout;
  const initXO = checkout?.initXO;
  const startFlow = checkout?.startFlow;
  const closeXO = checkout?.closeXO;
  if (options && typeof options.payment === "function" && typeof initXO === "function" && typeof startFlow === "function") {
    try {
      initXO();
    } catch {
      return clickPayPalCheckoutButton(root ?? document);
    }
    Promise.resolve()
      .then(() => options.payment?.({}, {}))
      .then((result) => {
        const id = paymentIdFromResult(result);
        if (!id) {
          closeXO?.();
          options.onError?.({ message: "No pudimos abrir PayPal. Intenta de nuevo." });
          return;
        }
        startFlow(id);
      })
      .catch((err: unknown) => {
        closeXO?.();
        options.onError?.(err);
      });
    return true;
  }
  return clickPayPalCheckoutButton(root ?? document);
}

export function isPaypalCheckoutCancelMessage(message?: string): boolean {
  return /se cancel[oó] el pago con paypal/i.test(message ?? "");
}

/**
 * GafaPayFront.PaypalPayment hace `paypal.Button.render(..., '#paypal')` y
 * asume que checkout.min.js ya esta en la pagina (en el fancy v1 lo inyectaba
 * el theme). Ademas pinta un `<div id="paypal">`: si el script no cargo,
 * `window.paypal` apunta al DIV y revienta con
 * "Cannot read properties of undefined (reading 'render')".
 */
export function ensureLegacyPaypalCheckout(): Promise<void> {
  if (hasLegacyPaypalButton()) return Promise.resolve();
  return loadScript(PAYPAL_CHECKOUT_JS).then(() => {
    if (!hasLegacyPaypalButton()) {
      throw new Error("No se pudo cargar el botón de PayPal. Intenta de nuevo.");
    }
  });
}

function stripeElementDefined(): boolean {
  return typeof customElements !== "undefined" && Boolean(customElements.get(STRIPE_PAYMENT_ELEMENT_TAG));
}

async function loadStripePaymentScript(scriptUrl?: string): Promise<void> {
  if (stripeElementDefined()) return;
  await loadScript(resolveStripePaymentScriptUrl(scriptUrl));
  if (!stripeElementDefined()) {
    throw new Error(PAY_FORM_LOAD_ERROR);
  }
}

async function loadStripeRuntime(credentials: GafaPayCredentials): Promise<Runtime> {
  await loadStripePaymentScript(credentials.scriptUrl);
  return STRIPE_RUNTIME;
}

/**
 * Carga (una sola vez) el runtime del método.
 * Stripe: IIFE de `<stripe-payment-element>`.
 * El resto: config + React 16 + GafaPayFront.
 * Si la pagina del socio ya tiene React 16 global (theme legacy), se reutiliza.
 */
export function loadGafaPay(credentials: GafaPayCredentials): Promise<Runtime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("GafaPay solo funciona en navegador."));
  }
  const provider: PaymentProvider = isStripePaymentMethod(credentials.method) ? "stripe" : "frontpay";
  const urls = resolvePaymentUrls({
    apiUrl: credentials.apiUrl,
    frontUrl: isStripePaymentMethod(credentials.method) ? undefined : credentials.scriptUrl,
    stripeScriptUrl: isStripePaymentMethod(credentials.method) ? credentials.scriptUrl : undefined,
  });
  const context: PaymentContext = {
    environment: configuredEnvironment,
    provider,
    urls,
    defaults: paymentConfigurationKey(resolvePaymentUrls(), provider),
  };
  try {
    assertSafePaymentUrls(urls);
    assertCompatibleProviderScript(urls, provider);
    if (configuredEnvironment !== "production" &&
        ((window.GafaPayElements && !runtimePromise) || (stripeElementDefined() && !stripeRuntimePromise))) {
      paymentLoadBlocked("hay un proveedor precargado de origen desconocido; usa una página limpia");
    }
  } catch (error) {
    return Promise.reject(error);
  }
  // En staging/dev fijar endpoints antes de cualquier await. Producción conserva el flujo legacy.
  if (configuredEnvironment !== "production") {
    credentials = { ...credentials, apiUrl: urls.apiUrl,
      scriptUrl: isStripePaymentMethod(credentials.method) ? urls.stripeScriptUrl : urls.frontUrl,
    };
  }
  const rememberContext = (runtime: Runtime): Runtime => {
    runtimeContexts.set(runtime, context);
    return runtime;
  };
  if (isStripePaymentMethod(credentials.method)) {
    if (stripeRuntimePromise) return stripeRuntimePromise;
    loadedPaymentConfigurations[provider] = context;
    stripeRuntimePromise = loadStripeRuntime(credentials).then(rememberContext).catch((error: unknown) => {
      stripeRuntimePromise = null;
      throw error;
    });
    return stripeRuntimePromise;
  }
  if (runtimePromise) return runtimePromise;
  loadedPaymentConfigurations[provider] = context;

  runtimePromise = (async () => {
    // La pagina del socio puede traer GafaPay ya cargado (theme legacy):
    // cargarlo otra vez duplicaria el script y su estado.
    const alreadyLoaded = Boolean(window.GafaPayElements);
    // Publicar el contrato antes de cargar JS; el bundle de staging usa su API compilada.
    if (shouldConfigureLegacyApi()) {
      if (configuredEnvironment === "production") {
        window.GAFAPAY_API_URL = resolveGafaPayApiUrl(credentials.apiUrl);
      } else {
        publishLegacyApi(urls.apiUrl);
      }
    }
    if (!alreadyLoaded) ensureConfigElement(credentials);
    // La publicación interna del global no es un cambio de configuración del consumidor.
    context.defaults = paymentConfigurationKey(resolvePaymentUrls(), provider);

    const hostReact = window.React;
    const hostReactDom = window.ReactDOM;
    const reuseHostReact = Boolean(readReact16());

    const react16 = reuseHostReact ? readReact16()! : await loadReact16();

    // Devolver los globales como estaban: el sitio del socio puede tener su
    // propio React y no queremos pisarselo por haber cargado el nuestro.
    if (!reuseHostReact) {
      const globals = window as unknown as Record<string, unknown>;
      if (hostReact) globals.React = hostReact;
      else delete globals.React;
      if (hostReactDom) globals.ReactDOM = hostReactDom;
      else delete globals.ReactDOM;
    }

    if (!alreadyLoaded) {
      await loadScript(resolveGafaPayFrontUrl(credentials.scriptUrl));
    }

    const elements = window.GafaPayElements;
    if (!elements) {
      throw new Error(PAY_FORM_LOAD_ERROR);
    }

    return { React: react16.React, ReactDOM: react16.ReactDOM, elements };
  })().then(rememberContext).catch((error: unknown) => {
    // Sin reset, un fallo de red dejaba el checkout muerto hasta recargar.
    runtimePromise = null;
    throw error;
  });

  return runtimePromise;
}

function componentFor(elements: GafaPayElementsGlobal, slug: string): unknown {
  switch (slug) {
    case "stripe":
      // El widget nuevo no vive en GafaPayElements; ver mountStripePaymentElement.
      return elements.StripePayment;
    case "paypal":
      return elements.PaypalPayment;
    case "conekta":
      return elements.ConektaPayment;
    case "srpago":
      return elements.SrpagoPayment;
    case "recurrente":
      return elements.RecurrentePayment;
    default:
      return elements.GenericPayment;
  }
}

export type GafaPayIsland = {
  update: (props: GafaPayWidgetProps) => void;
  unmount: () => void;
};

/**
 * El bundle de GafaPay se traga sus errores (si la marca tiene mal el
 * client_id/secret, la promesa de auth revienta por dentro y el contenedor se
 * queda vacio para siempre). Como no expone estado, se observa el DOM: si en
 * unos segundos no aparecio el formulario del proveedor, es que no arranco.
 */
export type WaitForWidgetContentOptions = {
  /**
   * Stripe: el IIFE pinta "Cargando…" / "Loading…" y luego el form+submit
   * antes de que el Payment Element esté listo. Si resolvemos en `form` o
   * `button`, el skeleton se va, se ve el loading y brinca el layout.
   */
  requireIframe?: boolean;
  /** No dar por listo mientras el IIFE muestre "Loading..." / "Cargando...". */
  hideIifeLoading?: boolean;
};

const IIFE_LOADING_TEXT = /\bLoading\.\.\.|\bCargando\.\.\./i;

export function stripePaymentSurfaceReady(container: Element, options?: WaitForWidgetContentOptions): boolean {
  if (options?.requireIframe) {
    if (!container.querySelector("iframe")) return false;
  } else if (!container.querySelector("iframe, form, input, button")) {
    return false;
  }
  if (options?.hideIifeLoading) {
    const text = (container.textContent ?? "").replace(/\s+/g, " ");
    if (IIFE_LOADING_TEXT.test(text)) return false;
  }
  return true;
}

export function waitForWidgetContent(
  container: Element,
  timeoutMs = widgetContentTimeoutMs(),
  options?: WaitForWidgetContentOptions,
): Promise<void> {
  const isReady = () => stripePaymentSurfaceReady(container, options);
  if (isReady()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error(PAY_FORM_LOAD_ERROR));
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      if (!isReady()) return;
      clearTimeout(timeout);
      observer.disconnect();
      resolve();
    });

    observer.observe(container, { childList: true, subtree: true, characterData: true });
  });
}

export type MountGafaPayOptions = {
  /**
   * Matrícula / cobro con tarjeta guardada: sigue usando StripePayment de
   * frontpay. El checkout de socios usa el web component nuevo.
   */
  legacy?: boolean;
};

function flagAttr(value: boolean | undefined): string {
  return value ? "true" : "false";
}

function applyStripePaymentAttributes(el: HTMLElement, props: GafaPayWidgetProps): void {
  const customerName =
    props.order.customerName ||
    [props.customerFirstName, props.customerLastName].filter(Boolean).join(" ").trim();
  el.setAttribute("api-url", resolveGafaPayApiUrl(props.apiUrl));
  el.setAttribute("client-id", String(props.clientId ?? ""));
  el.setAttribute("client-secret", String(props.clientSecret ?? ""));
  el.setAttribute("customer-name", customerName);
  if (props.customerFirstName) el.setAttribute("customer-first-name", props.customerFirstName);
  else el.removeAttribute("customer-first-name");
  if (props.customerLastName) el.setAttribute("customer-last-name", props.customerLastName);
  else el.removeAttribute("customer-last-name");
  if (props.order.customerEmail) el.setAttribute("customer-email", props.order.customerEmail);
  else el.removeAttribute("customer-email");
  if (props.order.customerPhone) el.setAttribute("customer-phone", props.order.customerPhone);
  else el.removeAttribute("customer-phone");
  el.setAttribute("line-items", JSON.stringify(props.order.lineItems ?? []));
  el.setAttribute("has-recurring-payment", flagAttr(props.hasRecurringPayment));
  el.setAttribute("general-data", JSON.stringify(props.generalData ?? {}));
  if (props.discountAmount != null && Number.isFinite(props.discountAmount) && props.discountAmount > 0) {
    el.setAttribute("discount-amount", String(Math.round(props.discountAmount)));
  } else {
    el.removeAttribute("discount-amount");
  }
  if (props.paymentFrequency) el.setAttribute("payment-frequency", String(props.paymentFrequency));
  else el.removeAttribute("payment-frequency");
  el.setAttribute("currency", (props.order.currency || "mxn").toLowerCase());
  if (props.termsAndConditions === false || props.termsAndConditions == null || props.termsAndConditions === "") {
    el.setAttribute("terms-and-conditions", "false");
  } else {
    el.setAttribute("terms-and-conditions", "true");
  }
}

function detailFromEvent(event: Event): unknown {
  return "detail" in event ? (event as CustomEvent).detail : undefined;
}

function bindStripePaymentEvents(el: HTMLElement, props: GafaPayWidgetProps): () => void {
  const onStart = () => props.onStartPayAction();
  const onSuccess = (event: Event) => {
    const detail = detailFromEvent(event);
    props.onGafaPaySuccessAction(
      detail && typeof detail === "object" ? (detail as GafaPaySuccess) : { message: detail },
    );
  };
  const onError = (event: Event) => {
    const detail = detailFromEvent(event);
    if (detail && typeof detail === "object") {
      props.onGafaPayErrAction(detail as { err?: unknown; message?: string });
      return;
    }
    props.onGafaPayErrAction({ message: typeof detail === "string" ? detail : "Ocurrió un error durante el pago." });
  };
  const onCreated = (event: Event) => props.onCheckoutOpenAction?.(detailFromEvent(event));
  const onUpdated = (event: Event) => {
    if (event.type === "gafa-stripe-payment-updated" || !hasStripeSession(el)) props.onInitialPaymentUpdated?.(detailFromEvent(event));
  };
  const onUpdating = () => props.onInitialPaymentUpdating?.();
  const onUpdateError = (event: Event) => {
    const detail = detailFromEvent(event);
    if (detail && typeof detail === "object") {
      props.onInitialPaymentUpdateError?.(detail as { err?: unknown; message?: string });
      return;
    }
    props.onInitialPaymentUpdateError?.({
      message: typeof detail === "string" ? detail : "No pudimos actualizar el pago.",
    });
  };

  el.addEventListener("payment-start", onStart);
  el.addEventListener("payment-success", onSuccess);
  el.addEventListener("payment-error", onError);
  el.addEventListener("initial-payment-created", onCreated);
  el.addEventListener("initial-payment-updated", onUpdated);
  el.addEventListener("gafa-stripe-payment-updated", onUpdated);
  el.addEventListener("initial-payment-updating", onUpdating);
  el.addEventListener("initial-payment-update-error", onUpdateError);

  return () => {
    el.removeEventListener("payment-start", onStart);
    el.removeEventListener("payment-success", onSuccess);
    el.removeEventListener("payment-error", onError);
    el.removeEventListener("initial-payment-created", onCreated);
    el.removeEventListener("initial-payment-updated", onUpdated);
    el.removeEventListener("gafa-stripe-payment-updated", onUpdated);
    el.removeEventListener("initial-payment-updating", onUpdating);
    el.removeEventListener("initial-payment-update-error", onUpdateError);
  };
}

function mountStripePaymentElement(runtime: Runtime, container: Element, props: GafaPayWidgetProps): GafaPayIsland {
  installStripeSessionFetchGuard();
  container.replaceChildren();
  const el = document.createElement(STRIPE_PAYMENT_ELEMENT_TAG);
  applyStripePaymentAttributes(el, props);
  let unbind = bindStripePaymentEvents(el, props);
  const unregister = registerStripeSession(el);
  container.appendChild(el);

  return {
    update: (next) => {
      next = widgetPropsForRuntime(runtime, next);
      unbind();
      applyStripePaymentAttributes(el, next);
      unbind = bindStripePaymentEvents(el, next);
      // El IIFE tiene attributeChangedCallback vacío. Si llamamos render()
      // React remonta hw con un `order`/`onPaymentError` nuevos y re-dispara
      // oauth + processinitialpayment + updateinitialpayment (a menudo con
      // tokenInput vacío → toast "Failed to update initial payment" y
      // "Error al autenticar con el servidor" intermitente). gafa.fit no llama
      // render(); el descuento entra por `buq__discount_added`.
    },
    unmount: () => {
      unregister();
      unbind();
      el.remove();
      container.replaceChildren();
    },
  };
}

function mountLegacyGafaPayWidget(
  runtime: Runtime,
  container: Element,
  slug: string,
  props: GafaPayWidgetProps,
): GafaPayIsland {
  const Component = componentFor(runtime.elements, slug);
  if (typeof Component !== "function") {
    throw new Error(`GafaPay no soporta el método de pago "${slug}".`);
  }

  const render = (next: GafaPayWidgetProps) => {
    runtime.ReactDOM.render(runtime.React.createElement(Component, widgetPropsForRuntime(runtime, next)), container);
  };

  render(props);

  return {
    update: render,
    unmount: () => {
      runtime.ReactDOM.unmountComponentAtNode(container);
    },
  };
}

/** Monta el formulario del proveedor dentro de `container`. */
export function mountGafaPayWidget(
  runtime: Runtime,
  container: Element,
  slug: string,
  props: GafaPayWidgetProps,
  options?: MountGafaPayOptions,
): GafaPayIsland {
  props = widgetPropsForRuntime(runtime, props);
  if (isStripePaymentMethod(slug) && !options?.legacy) {
    return mountStripePaymentElement(runtime, container, props);
  }
  return mountLegacyGafaPayWidget(runtime, container, slug, props);
}

/**
 * El IIFE escucha este evento para sustituir client_secret + checkout_token
 * sin remount (mismo contrato que gafa.fit tras stripe.addDiscount).
 */
export function notifyStripeDiscountAdded(detail: {
  client_secret: string;
  checkout_token: string;
}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("buq__discount_added", { detail }));
}

export function hasGafaPayRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.GafaPayElements);
}

function dispatchActivate(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  el.click();
}

function clickPayPalCheckoutButton(scope: ParentNode): boolean {
  const mount =
    scope.querySelector<HTMLElement>(".gafa-checkout-paymount[data-method='paypal']") ??
    scope.querySelector<HTMLElement>(".gafa-checkout-paymount__island") ??
    null;
  const host =
    mount?.querySelector<HTMLElement>("#paypal") ??
    scope.querySelector<HTMLElement>(".gafa-pay-native #paypal");
  if (!host) return false;
  // No clic al div vacío: eso devolvía true, el CTA se quedaba en Procesando
  // y PayPal nunca abría. checkout.js pinta `.paypal-button` (a veces sin <button>).
  const target =
    host.querySelector<HTMLElement>(".paypal-button, .paypal-button-container") ??
    host.querySelector<HTMLElement>("button, [role='button']");
  if (!target) return false;
  dispatchActivate(target);
  return true;
}

function clickStripePaymentSubmit(scope: ParentNode): boolean {
  const host =
    scope.querySelector<HTMLElement>(STRIPE_PAYMENT_ELEMENT_TAG) ??
    (scope instanceof HTMLElement && scope.tagName.toLowerCase() === STRIPE_PAYMENT_ELEMENT_TAG
      ? scope
      : null);
  const button = (host ?? scope).querySelector<HTMLButtonElement>("button[type='submit']");
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

/**
 * Dispara la confirmacion del metodo activo.
 *
 * Stripe (widget nuevo): el IIFE no registra `window._handleStripePayment`.
 * El CTA amarillo hace click en el `button[type=submit]` interno ("Pagar").
 * Fallback al handler global por si un test o el fancy legacy lo dejó puesto.
 *
 * PayPal y Recurrente: el CTA amarillo hace click en el botón que montó GafaPay.
 */
export function triggerGafaPayConfirm(slug: string, root?: ParentNode | null): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  let result: unknown;
  if (slug === "stripe") {
    if (clickStripePaymentSubmit(root ?? document)) return Promise.resolve(true);
    if (!window._handleStripePayment) return Promise.resolve(false);
    result = window._handleStripePayment();
  } else if (slug === "conekta" && window._handleConektaPayment) {
    result = window._handleConektaPayment();
  } else if (slug === "recurrente") {
    // RecurrentePayment no registra handler global: abre la ventana desde
    // el click de su botón "Pago con Tarjeta". El CTA amarillo lo dispara.
    const scope = root ?? document;
    const button = scope.querySelector<HTMLButtonElement>(
      ".gafa-checkout-paymount__island .gafapay-recurrente button, .gafapay-recurrente button",
    );
    if (!button) return Promise.resolve(false);
    button.click();
    return Promise.resolve(true);
  } else if (slug === "paypal") {
    return Promise.resolve(triggerPayPalCheckout(root ?? document));
  } else {
    return Promise.resolve(false);
  }

  return Promise.resolve(result).then(() => true);
}
