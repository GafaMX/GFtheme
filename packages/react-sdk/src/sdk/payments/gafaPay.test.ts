import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAYPAL_CTA_HIT_ID,
  PAY_FORM_LOAD_ERROR,
  STRIPE_PAYMENT_ELEMENT_TAG,
  WIDGET_CONTENT_TIMEOUT_MOBILE_MS,
  WIDGET_CONTENT_TIMEOUT_MS,
  installPayPalButtonCapture,
  isPaypalCheckoutCancelMessage,
  mountGafaPayWidget,
  triggerGafaPayConfirm,
  triggerPayPalCheckout,
  waitForWidgetContent,
  widgetContentTimeoutMs,
  notifyStripeDiscountAdded,
  stripePaymentSurfaceReady,
  type GafaPayWidgetProps,
  type PayPalButtonOptions,
} from "./gafaPay";

describe("triggerGafaPayConfirm", () => {
  afterEach(() => {
    delete window._handleStripePayment;
    delete window._handleConektaPayment;
    delete (window as unknown as { paypal?: unknown }).paypal;
    document.getElementById(PAYPAL_CTA_HIT_ID)?.remove();
  });

  it("propaga el throw async de StripePayment.handleSubmit si falta onStartPayAction", async () => {
    window._handleStripePayment = async () => {
      const onStartPayAction = undefined as unknown as () => void;
      onStartPayAction();
    };

    await expect(triggerGafaPayConfirm("stripe")).rejects.toThrow(/is not a function/);
  });

  it("resuelve true cuando el handler de Stripe termina", async () => {
    window._handleStripePayment = async () => undefined;
    await expect(triggerGafaPayConfirm("stripe")).resolves.toBe(true);
  });

  it("resuelve false si el metodo no tiene handler", async () => {
    await expect(triggerGafaPayConfirm("stripe")).resolves.toBe(false);
    await expect(triggerGafaPayConfirm("paypal")).resolves.toBe(false);
  });

  it("Stripe dispara el submit del <stripe-payment-element>", async () => {
    const host = document.createElement("div");
    const widget = document.createElement(STRIPE_PAYMENT_ELEMENT_TAG);
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Pagar";
    widget.appendChild(button);
    host.appendChild(widget);
    document.body.appendChild(host);
    const clicked = vi.fn();
    button.addEventListener("click", clicked);

    await expect(triggerGafaPayConfirm("stripe", host)).resolves.toBe(true);
    expect(clicked).toHaveBeenCalledTimes(1);
    host.remove();
  });

  it("Stripe no dispara un submit deshabilitado (Rellenar Campos)", async () => {
    const host = document.createElement("div");
    const widget = document.createElement(STRIPE_PAYMENT_ELEMENT_TAG);
    const button = document.createElement("button");
    button.type = "submit";
    button.disabled = true;
    widget.appendChild(button);
    host.appendChild(widget);
    document.body.appendChild(host);

    await expect(triggerGafaPayConfirm("stripe", host)).resolves.toBe(false);
    host.remove();
  });

  it("PayPal dispara el #paypal de checkout.js", async () => {
    const host = document.createElement("div");
    host.id = "paypal";
    const button = document.createElement("button");
    button.className = "paypal-button";
    host.appendChild(button);
    const island = document.createElement("div");
    island.className = "gafa-checkout-paymount__island";
    island.appendChild(host);
    document.body.appendChild(island);
    const clicked = vi.fn();
    button.addEventListener("click", clicked);

    await expect(triggerGafaPayConfirm("paypal")).resolves.toBe(true);
    expect(clicked).toHaveBeenCalledTimes(1);
    island.remove();
  });

  it("PayPal no dispara un #paypal vacío (eso dejaba Procesando sin abrir nada)", async () => {
    const host = document.createElement("div");
    host.id = "paypal";
    const island = document.createElement("div");
    island.className = "gafa-checkout-paymount";
    island.setAttribute("data-method", "paypal");
    const nest = document.createElement("div");
    nest.className = "gafa-checkout-paymount__island";
    nest.appendChild(host);
    island.appendChild(nest);
    document.body.appendChild(island);

    await expect(triggerGafaPayConfirm("paypal")).resolves.toBe(false);
    island.remove();
  });

  it("Recurrente dispara el botón de GafaPayFront (abre la otra ventana)", async () => {
    const button = document.createElement("button");
    button.textContent = "Pago con Tarjeta";
    const wrap = document.createElement("div");
    wrap.className = "gafapay-recurrente";
    wrap.appendChild(button);
    document.body.appendChild(wrap);
    const clicked = vi.fn();
    button.addEventListener("click", clicked);

    await expect(triggerGafaPayConfirm("recurrente")).resolves.toBe(true);
    expect(clicked).toHaveBeenCalledTimes(1);
    wrap.remove();
  });
});

type PaypalTestGlobal = {
  Button?: { render?: (options: PayPalButtonOptions, selector: string | Element) => unknown };
  checkout?: { initXO?: () => void; startFlow?: (token: string) => void; closeXO?: () => void };
};

function paypalGlobal(): PaypalTestGlobal {
  return (window as unknown as { paypal: PaypalTestGlobal }).paypal;
}

describe("PayPal Button.render capture + initXO", () => {
  afterEach(() => {
    delete (window as unknown as { paypal?: unknown }).paypal;
    document.getElementById(PAYPAL_CTA_HIT_ID)?.remove();
    document.getElementById("paypal")?.remove();
  });

  function fakePaypal() {
    const startFlow = vi.fn();
    const initXO = vi.fn();
    const closeXO = vi.fn();
    const render = (_options: PayPalButtonOptions, selector: string | Element) => {
      const node = typeof selector === "string" ? document.querySelector(selector) : selector;
      if (node instanceof HTMLElement) {
        node.innerHTML = `<div class="paypal-button" role="button">PayPal</div>`;
      }
    };
    (window as unknown as { paypal: unknown }).paypal = {
      Button: { render },
      checkout: { initXO, startFlow, closeXO },
    };
    return { startFlow, initXO, closeXO };
  }

  it("clona el botón de checkout.js encima del CTA amarillo", () => {
    const hit = document.createElement("div");
    hit.id = PAYPAL_CTA_HIT_ID;
    document.body.appendChild(hit);
    const host = document.createElement("div");
    host.id = "paypal";
    document.body.appendChild(host);
    fakePaypal();
    const stop = installPayPalButtonCapture();
    paypalGlobal().Button!.render!({ payment: () => "PAY-1" }, "#paypal");
    expect(hit.querySelector(".paypal-button")).toBeTruthy();
    expect(host.querySelector(".paypal-button")).toBeTruthy();
    stop();
  });

  it("el CTA abre PayPal con initXO en el mismo clic (no un click sintético al iframe)", async () => {
    const hit = document.createElement("div");
    hit.id = PAYPAL_CTA_HIT_ID;
    document.body.appendChild(hit);
    const { initXO, startFlow } = fakePaypal();
    const stop = installPayPalButtonCapture();
    paypalGlobal().Button!.render!({ payment: () => "PAY-99" }, "#paypal");

    expect(triggerPayPalCheckout()).toBe(true);
    expect(initXO).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(startFlow).toHaveBeenCalledWith("PAY-99"));
    stop();
  });

  it("si payment no trae id, cierra el popup y avisa", async () => {
    const onError = vi.fn();
    const { initXO, closeXO, startFlow } = fakePaypal();
    const stop = installPayPalButtonCapture();
    paypalGlobal().Button!.render!({ payment: () => undefined, onError }, "#paypal");

    expect(triggerPayPalCheckout()).toBe(true);
    expect(initXO).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(closeXO).toHaveBeenCalledTimes(1));
    expect(startFlow).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
    stop();
  });
});

describe("isPaypalCheckoutCancelMessage", () => {
  it("reconoce la cancelación de GafaPayFront", () => {
    expect(isPaypalCheckoutCancelMessage("Se canceló el pago con PayPal.")).toBe(true);
    expect(isPaypalCheckoutCancelMessage("Ocurrió un error al completar el pago")).toBe(false);
  });
});

describe("widgetContentTimeoutMs", () => {
  it("da más tiempo en móvil que en desktop", () => {
    expect(widgetContentTimeoutMs(375)).toBe(WIDGET_CONTENT_TIMEOUT_MOBILE_MS);
    expect(widgetContentTimeoutMs(768)).toBe(WIDGET_CONTENT_TIMEOUT_MOBILE_MS);
    expect(widgetContentTimeoutMs(1280)).toBe(WIDGET_CONTENT_TIMEOUT_MS);
  });
});

describe("waitForWidgetContent", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resuelve cuando aparece un iframe", async () => {
    const box = document.createElement("div");
    document.body.appendChild(box);
    const pending = waitForWidgetContent(box, 1000);
    box.appendChild(document.createElement("iframe"));
    await expect(pending).resolves.toBeUndefined();
    box.remove();
  });

  it("con requireIframe no resuelve en un button (Loading... del IIFE)", async () => {
    vi.useFakeTimers();
    const box = document.createElement("div");
    const pending = waitForWidgetContent(box, 50, { requireIframe: true });
    const button = document.createElement("button");
    button.type = "submit";
    box.appendChild(button);
    const expectReject = expect(pending).rejects.toThrow(PAY_FORM_LOAD_ERROR);
    await vi.advanceTimersByTimeAsync(50);
    await expectReject;
  });

  it("con hideIifeLoading no da por listo si sigue el texto Loading...", async () => {
    vi.useFakeTimers();
    const box = document.createElement("div");
    box.appendChild(document.createElement("iframe"));
    const loading = document.createElement("div");
    loading.textContent = "Loading...";
    box.appendChild(loading);
    expect(stripePaymentSurfaceReady(box, { requireIframe: true, hideIifeLoading: true })).toBe(false);
    const pending = waitForWidgetContent(box, 50, { requireIframe: true, hideIifeLoading: true });
    const expectReject = expect(pending).rejects.toThrow(PAY_FORM_LOAD_ERROR);
    await vi.advanceTimersByTimeAsync(50);
    await expectReject;
  });

  it("con hideIifeLoading resuelve cuando desaparece Cargando...", async () => {
    const box = document.createElement("div");
    document.body.appendChild(box);
    box.appendChild(document.createElement("iframe"));
    const loading = document.createElement("div");
    loading.textContent = "Cargando...";
    box.appendChild(loading);
    const pending = waitForWidgetContent(box, 1000, { requireIframe: true, hideIifeLoading: true });
    loading.remove();
    await expect(pending).resolves.toBeUndefined();
    box.remove();
  });

  it("con requireIframe resuelve cuando aparece el iframe de Stripe", async () => {
    const box = document.createElement("div");
    document.body.appendChild(box);
    const pending = waitForWidgetContent(box, 1000, { requireIframe: true });
    box.appendChild(document.createElement("iframe"));
    await expect(pending).resolves.toBeUndefined();
    box.remove();
  });

  it("rechaza con el toast de formulario si no aparece nada", async () => {
    vi.useFakeTimers();
    const box = document.createElement("div");
    const pending = waitForWidgetContent(box, 50);
    const expectReject = expect(pending).rejects.toThrow(PAY_FORM_LOAD_ERROR);
    await vi.advanceTimersByTimeAsync(50);
    await expectReject;
  });
});

describe("mountGafaPayWidget stripe-payment-element", () => {
  const runtime = {
    React: { createElement: () => null },
    ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true },
    elements: {},
  };

  function baseProps(overrides: Partial<GafaPayWidgetProps> = {}): GafaPayWidgetProps {
    return {
      order: {
        customerName: "Ana Pérez",
        customerEmail: "ana@fitspin.mx",
        lineItems: [],
        currency: "MXN",
      },
      generalData: { companiesId: 1, locationsId: 122, usersProfilesId: 4412, usersId: 99 },
      apiUrl: "https://apipay.buq.partners",
      clientId: "282",
      clientSecret: "secret",
      customerFirstName: "Ana",
      customerLastName: "Pérez",
      hasRecurringPayment: false,
      onStartPayAction: () => undefined,
      onGafaPaySuccessAction: () => undefined,
      onGafaPayErrAction: () => undefined,
      ...overrides,
    };
  }

  it("monta el web component con el contrato de gafa.fit", () => {
    const box = document.createElement("div");
    const island = mountGafaPayWidget(runtime, box, "stripe", baseProps({ discountAmount: 10, paymentFrequency: "30" }));
    const el = box.querySelector(STRIPE_PAYMENT_ELEMENT_TAG);
    expect(el).toBeTruthy();
    expect(el?.getAttribute("api-url")).toBe("https://apipay.buq.partners");
    expect(el?.getAttribute("client-id")).toBe("282");
    expect(el?.getAttribute("customer-first-name")).toBe("Ana");
    expect(el?.getAttribute("currency")).toBe("mxn");
    expect(el?.getAttribute("discount-amount")).toBe("10");
    expect(el?.getAttribute("payment-frequency")).toBe("30");
    island.unmount();
  });

  it("update no llama render() del web component (eso re-dispara oauth)", () => {
    const box = document.createElement("div");
    const island = mountGafaPayWidget(runtime, box, "stripe", baseProps());
    const el = box.querySelector(STRIPE_PAYMENT_ELEMENT_TAG) as HTMLElement & { render?: () => void };
    const render = vi.fn();
    el.render = render;
    island.update(baseProps({ customerFirstName: "Ana" }));
    expect(render).not.toHaveBeenCalled();
    expect(el.getAttribute("customer-first-name")).toBe("Ana");
    island.unmount();
  });

  it("mapea los eventos del widget a los callbacks del checkout", () => {
    const box = document.createElement("div");
    const onStart = vi.fn();
    const onSuccess = vi.fn();
    const onCreated = vi.fn();
    const island = mountGafaPayWidget(
      runtime,
      box,
      "stripe",
      baseProps({
        onStartPayAction: onStart,
        onGafaPaySuccessAction: onSuccess,
        onCheckoutOpenAction: onCreated,
      }),
    );
    const el = box.querySelector(STRIPE_PAYMENT_ELEMENT_TAG)!;
    el.dispatchEvent(new CustomEvent("payment-start", { detail: {} }));
    el.dispatchEvent(new CustomEvent("initial-payment-created", { detail: { message: "chk_1" } }));
    el.dispatchEvent(new CustomEvent("payment-success", { detail: { message: "ok" } }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith({ message: "chk_1" });
    expect(onSuccess).toHaveBeenCalledWith({ message: "ok" });
    island.unmount();
    expect(box.querySelector(STRIPE_PAYMENT_ELEMENT_TAG)).toBeNull();
  });

  it("notifyStripeDiscountAdded dispara buq__discount_added", () => {
    const seen = vi.fn();
    window.addEventListener("buq__discount_added", seen as EventListener);
    notifyStripeDiscountAdded({ client_secret: "cs_x", checkout_token: "chk_x" });
    expect(seen).toHaveBeenCalledTimes(1);
    const event = seen.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ client_secret: "cs_x", checkout_token: "chk_x" });
    window.removeEventListener("buq__discount_added", seen as EventListener);
  });
});
