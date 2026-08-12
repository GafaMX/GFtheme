/**
 * Bridge hacia GafaPay / GafaPayFront.
 *
 * El procesador real (Stripe Elements, PayPal Buttons, etc.) lo monta
 * `window.GafaPayElements` o el nuevo `window.GafaPayFront` cuando el socio
 * carga el script de GafaPay en su pagina. Este modulo NO reimplementa Stripe:
 * solo detecta, monta y reporta el token/`payment_data` listo para
 * `initial-purchase`.
 */

export type GafaPayMethodSlug = "stripe" | "paypal" | "conekta" | string;

export type GafaPayMountOptions = {
  method: GafaPayMethodSlug;
  container: HTMLElement;
  customer: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  amount: number;
  currencyCode: string;
  /** gafapay_brand_id / client de la marca (si el script lo pide). */
  gafapayBrandId?: number | null;
  gafapayClientId?: string | null;
  onReady?: () => void;
  onError?: (message: string) => void;
};

export type GafaPayHandle = {
  /** Recolecta payment_data / token del widget montado. */
  collectPaymentData: () => Promise<Record<string, unknown>>;
  destroy: () => void;
  /** true si se monto el procesador real; false = UI de espera del script. */
  isLive: boolean;
};

type GafaPayElementsGlobal = {
  StripePayment?: new (opts: Record<string, unknown>) => GafaPayWidget;
  PaypalPayment?: new (opts: Record<string, unknown>) => GafaPayWidget;
  ConektaPayment?: new (opts: Record<string, unknown>) => GafaPayWidget;
  GenericPayment?: new (opts: Record<string, unknown>) => GafaPayWidget;
};

type GafaPayFrontGlobal = {
  mount?: (opts: Record<string, unknown>) => GafaPayWidget | Promise<GafaPayWidget>;
  Stripe?: new (opts: Record<string, unknown>) => GafaPayWidget;
  PayPal?: new (opts: Record<string, unknown>) => GafaPayWidget;
};

type GafaPayWidget = {
  mount?: (el: HTMLElement) => void | Promise<void>;
  render?: (el: HTMLElement) => void | Promise<void>;
  getPaymentData?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
  getToken?: () => string | Promise<string>;
  destroy?: () => void;
  unmount?: () => void;
};

declare global {
  interface Window {
    GafaPayElements?: GafaPayElementsGlobal;
    GafaPayFront?: GafaPayFrontGlobal;
  }
}

export function hasGafaPayRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.GafaPayFront || window.GafaPayElements);
}

export function mountGafaPay(options: GafaPayMountOptions): GafaPayHandle {
  const { container, method, customer, amount, currencyCode } = options;
  container.innerHTML = "";

  const front = typeof window !== "undefined" ? window.GafaPayFront : undefined;
  const elements = typeof window !== "undefined" ? window.GafaPayElements : undefined;

  // 1) GafaPayFront (nuevo): preferido si existe.
  if (front?.mount) {
    let widget: GafaPayWidget | null = null;
    void Promise.resolve(
      front.mount({
        method,
        el: container,
        container,
        amount,
        currency: currencyCode,
        customer,
        brandId: options.gafapayBrandId,
        clientId: options.gafapayClientId,
      }),
    )
      .then((instance) => {
        widget = instance;
        options.onReady?.();
      })
      .catch((err: unknown) => {
        options.onError?.(err instanceof Error ? err.message : "No se pudo montar GafaPayFront.");
      });

    return {
      isLive: true,
      async collectPaymentData() {
        if (!widget) throw new Error("El procesador de pago aún no está listo.");
        if (widget.getPaymentData) return widget.getPaymentData();
        if (widget.getToken) return { token: await widget.getToken() };
        return {};
      },
      destroy() {
        widget?.destroy?.();
        widget?.unmount?.();
        container.innerHTML = "";
      },
    };
  }

  // 2) GafaPayElements (legacy fancy): StripePayment / PaypalPayment.
  const Ctor =
    method === "stripe"
      ? elements?.StripePayment ?? front?.Stripe
      : method === "paypal"
        ? elements?.PaypalPayment ?? front?.PayPal
        : elements?.GenericPayment;

  if (Ctor) {
    const widget = new Ctor({
      order: {
        customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim(),
        customerEmail: customer.email,
        customerPhone: customer.phone,
        amount,
        currency: currencyCode,
      },
      amount,
      currency: currencyCode,
      brandId: options.gafapayBrandId,
      clientId: options.gafapayClientId,
    });

    const mountTarget = widget.mount ?? widget.render;
    if (mountTarget) {
      void Promise.resolve(mountTarget.call(widget, container))
        .then(() => options.onReady?.())
        .catch((err: unknown) => {
          options.onError?.(err instanceof Error ? err.message : "No se pudo montar el pago.");
        });
    } else {
      // Algunos builds pintan solos al construirse; dejamos el contenedor listo.
      options.onReady?.();
    }

    return {
      isLive: true,
      async collectPaymentData() {
        if (widget.getPaymentData) return widget.getPaymentData();
        if (widget.getToken) return { token: await widget.getToken() };
        return {};
      },
      destroy() {
        widget.destroy?.();
        widget.unmount?.();
        container.innerHTML = "";
      },
    };
  }

  // 3) Sin script: placeholder para que el diseño se vea completo en el demo.
  container.innerHTML = `
    <div class="gafa-pay-placeholder" data-method="${method}">
      <p class="gafa-pay-placeholder__title">${method === "paypal" ? "PayPal" : "Tarjeta (Stripe)"}</p>
      <p class="gafa-pay-placeholder__hint">
        Carga <code>GafaPayFront</code> o <code>GafaPayElements</code> en la página
        para activar el procesador real. El diseño y el flujo ya están listos.
      </p>
      ${
        method === "stripe"
          ? `<div class="gafa-pay-placeholder__card" aria-hidden="true">
              <span>Número de tarjeta</span>
              <span>•••• •••• •••• ••••</span>
            </div>`
          : `<div class="gafa-pay-placeholder__paypal" aria-hidden="true">PayPal Checkout</div>`
      }
    </div>
  `;
  options.onReady?.();

  return {
    isLive: false,
    async collectPaymentData() {
      throw new Error(
        "Falta el script de GafaPay (GafaPayFront / GafaPayElements) para cobrar en este sitio.",
      );
    },
    destroy() {
      container.innerHTML = "";
    },
  };
}
