import React from "react";

/**
 * Bridge hacia GafaPayFront (frontpay.buq.partners/main.js).
 *
 * Ese script expone `window.GafaPayElements` con COMPONENTES React
 * (StripePayment, PaypalPayment, ...) que montan el procesador real
 * (Stripe Elements, botón PayPal). El contrato viene del fancy v1
 * (buildTemplate.js):
 *
 *   <StripePayment
 *     order={{ customerName, customerEmail, customerPhone, lineItems }}
 *     generalData={{ companiesId, locationsId, usersProfilesId, usersId, adminProfilesId }}
 *     onStartPayAction={...}
 *     onGafaPaySuccessAction={({ message, subscriptionId, recurringPayment }) => ...}
 *     onGafaPayErrAction={({ message }) => ...}
 *   />
 *
 * El `message` del success ES el `payment_data` que espera initial-purchase.
 * Stripe confirma con window._handleStripePayment(); PayPal usa su propio botón.
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
};

export type GafaPayGeneralData = {
  companiesId?: number;
  locationsId?: number;
  adminProfilesId?: number | null;
  usersProfilesId?: number;
  usersId?: number;
};

export type GafaPaySuccess = {
  /** payment_data para initial-purchase. */
  message: unknown;
  subscriptionId?: string | number | null;
  recurringPayment?: boolean;
};

type GafaPayComponentProps = {
  order: GafaPayOrder;
  generalData: GafaPayGeneralData;
  onStartPayAction?: () => void;
  onGafaPaySuccessAction: (result: GafaPaySuccess) => void;
  onGafaPayErrAction: (error: { err?: unknown; message?: string }) => void;
  termsAndConditions?: string | null;
  hasRecurringPayment?: boolean;
  paymentFrequency?: string | null;
  changePaymentSystemProperties?: (props: { recurringPayment?: boolean; saveCard?: boolean }) => void;
};

type GafaPayElementsGlobal = {
  StripePayment?: React.ComponentType<GafaPayComponentProps>;
  PaypalPayment?: React.ComponentType<GafaPayComponentProps>;
  ConektaPayment?: React.ComponentType<GafaPayComponentProps>;
  GenericPayment?: React.ComponentType<GafaPayComponentProps>;
};

declare global {
  interface Window {
    GafaPayElements?: GafaPayElementsGlobal;
    _handleStripePayment?: () => void;
    _handleConektaPayment?: () => void;
    _handleTwoCheckoutPayment?: () => void;
  }
}

export const DEFAULT_GAFAPAY_FRONT_URL = "https://frontpay.buq.partners/main.js";

let loadPromise: Promise<GafaPayElementsGlobal> | null = null;

export function hasGafaPayRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.GafaPayElements);
}

/** Carga frontpay/main.js una sola vez y resuelve con window.GafaPayElements. */
export function loadGafaPayFront(scriptUrl = DEFAULT_GAFAPAY_FRONT_URL): Promise<GafaPayElementsGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("GafaPayFront solo funciona en navegador."));
  }
  if (window.GafaPayElements) return Promise.resolve(window.GafaPayElements);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<GafaPayElementsGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${scriptUrl}"]`);
    const script = existing ?? document.createElement("script");

    const done = () => {
      if (window.GafaPayElements) resolve(window.GafaPayElements);
      else reject(new Error("GafaPayFront cargó pero no expuso GafaPayElements."));
    };

    if (!existing) {
      script.src = scriptUrl;
      script.async = true;
      script.addEventListener("load", done);
      script.addEventListener("error", () => {
        loadPromise = null;
        reject(new Error("No se pudo cargar el script de GafaPayFront."));
      });
      document.head.appendChild(script);
    } else if (window.GafaPayElements) {
      done();
    } else {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => {
        loadPromise = null;
        reject(new Error("No se pudo cargar el script de GafaPayFront."));
      });
    }
  });

  return loadPromise;
}

export function getGafaPayComponent(
  elements: GafaPayElementsGlobal,
  slug: string,
): React.ComponentType<GafaPayComponentProps> | null {
  switch (slug) {
    case "stripe":
      return elements.StripePayment ?? null;
    case "paypal":
      return elements.PaypalPayment ?? null;
    case "conekta":
      return elements.ConektaPayment ?? null;
    default:
      return elements.GenericPayment ?? null;
  }
}

/**
 * Dispara la confirmación del método activo (contrato del fancy v1: cada
 * componente registra su handler global al montarse). PayPal no aplica:
 * su botón propio maneja el submit.
 */
export function triggerGafaPayConfirm(slug: string): boolean {
  if (typeof window === "undefined") return false;
  if (slug === "stripe" && window._handleStripePayment) {
    window._handleStripePayment();
    return true;
  }
  if (slug === "conekta" && window._handleConektaPayment) {
    window._handleConektaPayment();
    return true;
  }
  return false;
}

export type { GafaPayComponentProps, GafaPayElementsGlobal };
