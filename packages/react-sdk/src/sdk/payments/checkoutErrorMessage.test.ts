import { describe, expect, it } from "vitest";
import { humanizeCheckoutError } from "./checkoutErrorMessage";

describe("humanizeCheckoutError", () => {
  it("deja el CVC en una frase, sin Stripe ni ERROR-05", () => {
    expect(
      humanizeCheckoutError(
        "Ocurrió un error al completar el pago con Stripe. ERROR-05: No se pudo crear la tarjeta. Your card's security code is invalid.",
      ),
    ).toBe("Código de seguridad inválido.");
  });

  it("no habla de runtime al usuario", () => {
    expect(humanizeCheckoutError("No se pudo preparar el runtime de pago.")).toBe(
      "No se pudo cargar el formulario de pago. Inténtalo de nuevo.",
    );
  });

  it("no toca el aviso de cobro ya hecho", () => {
    const charged =
      "Tu tarjeta ya fue cobrada, pero Buq no registró la compra. No vuelvas a pagar.";
    expect(humanizeCheckoutError(charged)).toBe(charged);
  });

  it("tarjeta rechazada y número inválido", () => {
    expect(humanizeCheckoutError("Your card was declined.")).toBe(
      "La tarjeta fue rechazada. Prueba con otra.",
    );
    expect(humanizeCheckoutError("Your card number is invalid.")).toBe(
      "El número de tarjeta no es válido.",
    );
  });
});
