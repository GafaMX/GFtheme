import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAYPAL_CTA_HIT_ID,
  installPayPalButtonCapture,
  isPaypalCheckoutCancelMessage,
  triggerGafaPayConfirm,
  triggerPayPalCheckout,
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
