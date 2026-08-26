/**
 * Bridge hacia GafaPayFront (frontpay.buq.partners/main.js).
 *
 * GafaPayFront trae su PROPIO React 16.8.6 dentro del bundle. Sus componentes
 * (StripePayment, PaypalPayment...) devuelven elementos creados por ese React,
 * y React 19 los rechaza en duro: "A React Element from an older version of
 * React was rendered" (error #525). Por eso NO se pueden renderizar dentro de
 * nuestro arbol: se montan como isla, con un ReactDOM 16 aparte, en un div que
 * nuestro React reserva pero no toca.
 *
 * El bundle tambien exige su configuracion en el DOM ANTES de evaluarse:
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
   * `{ redirect, checkout_token|id }` en cuanto tiene la URL. Ahí hay que
   * POSTear `initial-purchase` y pollar el status.
   */
  onCheckoutOpenAction?: (data: unknown, done?: () => void) => void;
  onCheckoutCloseAction?: () => void;
  termsAndConditions?: string | boolean | null;
  hasRecurringPayment?: boolean;
  paymentFrequency?: string | null;
  changePaymentSystemProperties?: (props: { recurringPayment?: boolean; saveCard?: boolean }) => void;
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
    React?: ReactLike;
    ReactDOM?: ReactDomLike;
    _handleStripePayment?: () => unknown;
    _handleConektaPayment?: () => unknown;
    _handleRecurrentePayment?: () => unknown;
  }
}

export const DEFAULT_GAFAPAY_FRONT_URL = "https://frontpay.buq.partners/main.js";
const REACT16_URL = "https://unpkg.com/react@16.8.6/umd/react.production.min.js";
const REACT_DOM16_URL = "https://unpkg.com/react-dom@16.8.6/umd/react-dom.production.min.js";
/** API clasica que GafaPayFront.PaypalPayment llama (`paypal.Button.render`). */
const PAYPAL_CHECKOUT_JS = "https://www.paypalobjects.com/api/checkout.min.js";

let configuredFrontUrl: string | undefined;

/** Lo llama createGafaSdk con el front del entorno (production/staging/dev). */
export function setGafaPayFrontUrl(url?: string): void {
  configuredFrontUrl = url;
}

export function resolveGafaPayFrontUrl(override?: string): string {
  return override || configuredFrontUrl || (typeof window !== "undefined" ? window.GAFAPAY_SDK_URL : undefined) || DEFAULT_GAFAPAY_FRONT_URL;
}

export type GafaPayCredentials = {
  clientId: string | number;
  clientSecret: string;
  scriptUrl?: string;
};

type Runtime = {
  React: ReactLike;
  ReactDOM: ReactDomLike;
  elements: GafaPayElementsGlobal;
};

let runtimePromise: Promise<Runtime> | null = null;

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

function ensureConfigElement(credentials: GafaPayCredentials): void {
  const existing = document.querySelector("[data-gafapay-config]");
  if (existing) return;

  const script = document.createElement("script");
  script.type = "application/json";
  script.setAttribute("data-gafapay-config", "");
  // El bundle lee CLIENT_ID/CLIENT_SECRET al evaluarse; si falta, se queda sin
  // token y los metodos de pago nunca llegan ("debe completar las configuraciones").
  script.textContent = JSON.stringify({
    CLIENT_ID: Number(credentials.clientId) || credentials.clientId,
    CLIENT_SECRET: credentials.clientSecret,
  });
  document.head.appendChild(script);
}

function isReact16(candidate?: ReactLike): boolean {
  return Boolean(candidate?.version && candidate.version.startsWith("16"));
}

type LegacyPaypal = {
  Button?: { render?: unknown };
};

function hasLegacyPaypalButton(): boolean {
  if (typeof window === "undefined") return false;
  const paypal = (window as unknown as { paypal?: LegacyPaypal }).paypal;
  return typeof paypal?.Button?.render === "function";
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

/**
 * Carga (una sola vez) config + React 16 + GafaPayFront y devuelve el runtime.
 * Si la pagina del socio ya tiene React 16 global (theme legacy), se reutiliza.
 */
export function loadGafaPay(credentials: GafaPayCredentials): Promise<Runtime> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("GafaPay solo funciona en navegador."));
  }
  if (runtimePromise) return runtimePromise;

  runtimePromise = (async () => {
    // La pagina del socio puede traer GafaPay ya cargado (theme legacy):
    // cargarlo otra vez duplicaria el script y su estado.
    const alreadyLoaded = Boolean(window.GafaPayElements);
    if (!alreadyLoaded) ensureConfigElement(credentials);

    const hostReact = window.React;
    const hostReactDom = window.ReactDOM;
    const reuseHostReact = isReact16(hostReact) && Boolean(hostReactDom?.render);

    if (!reuseHostReact) {
      await loadScript(REACT16_URL);
      await loadScript(REACT_DOM16_URL);
    }

    const react = window.React;
    const reactDom = window.ReactDOM;
    if (!react || !reactDom?.render) {
      throw new Error("No se pudo preparar el runtime de pago.");
    }

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
      throw new Error("GafaPay cargó pero no expuso sus formularios de pago.");
    }

    return { React: react, ReactDOM: reactDom, elements };
  })().catch((error: unknown) => {
    // Sin reset, un fallo de red dejaba el checkout muerto hasta recargar.
    runtimePromise = null;
    throw error;
  });

  return runtimePromise;
}

function componentFor(elements: GafaPayElementsGlobal, slug: string): unknown {
  switch (slug) {
    case "stripe":
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
export function waitForWidgetContent(container: Element, timeoutMs = 9000): Promise<void> {
  const isReady = () => Boolean(container.querySelector("iframe, form, input, button"));
  if (isReady()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(
        new Error(
          "El formulario de pago no cargó. Revisa que la marca tenga bien configurado GafaPay.",
        ),
      );
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      if (!isReady()) return;
      clearTimeout(timeout);
      observer.disconnect();
      resolve();
    });

    observer.observe(container, { childList: true, subtree: true });
  });
}

/** Monta el formulario del proveedor dentro de `container` (isla React 16). */
export function mountGafaPayWidget(
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
    runtime.ReactDOM.render(runtime.React.createElement(Component, next), container);
  };

  render(props);

  return {
    update: render,
    unmount: () => {
      runtime.ReactDOM.unmountComponentAtNode(container);
    },
  };
}

export function hasGafaPayRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.GafaPayElements);
}

/**
 * Dispara la confirmacion del metodo activo. Cada formulario registra su
 * handler global al montarse (mismo contrato que el fancy v1). PayPal y
 * Recurrente no: el CTA amarillo hace click en el botón que montó GafaPay.
 *
 * StripePayment.handleSubmit es `async` y puede rechazar (p.ej. si falta
 * onStartPayAction). Hay que await-ear el retorno: un fire-and-forget deja
 * el throw como unhandled rejection y el UI se queda en "Procesando…".
 */
export function triggerGafaPayConfirm(slug: string, root?: ParentNode | null): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  let result: unknown;
  if (slug === "stripe" && window._handleStripePayment) {
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
    // PaypalPayment tampoco registra handler: checkout.js vive en #paypal.
    const scope = root ?? document;
    const host = scope.querySelector<HTMLElement>(
      ".gafa-checkout-paymount__island #paypal, .gafa-pay-native #paypal, #paypal",
    );
    if (!host) return Promise.resolve(false);
    const target =
      host.querySelector<HTMLElement>("button, .paypal-button, [role='button']") ?? host;
    target.click();
    return Promise.resolve(true);
  } else {
    return Promise.resolve(false);
  }

  return Promise.resolve(result).then(() => true);
}
