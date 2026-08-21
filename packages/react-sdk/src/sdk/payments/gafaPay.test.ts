import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerGafaPayConfirm } from "./gafaPay";

describe("triggerGafaPayConfirm", () => {
  afterEach(() => {
    delete window._handleStripePayment;
    delete window._handleConektaPayment;
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
