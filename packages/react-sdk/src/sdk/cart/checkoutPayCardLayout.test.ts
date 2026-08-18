import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const widgetsCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../widgets/widgets.css"),
  "utf8",
);

/** Bloque de la isla de pago: lo que toca el markup de GafaPayFront. */
const payMountCss = widgetsCss.slice(widgetsCss.indexOf(".gafa-checkout-paymount"));

describe("checkout Stripe saved-card layout", () => {
  it("la tarjeta nueva y la guardada comparten ancho y alto", () => {
    expect(payMountCss).toMatch(
      /\.gafa-checkout-paymount \.card-list__item \{[^}]*min-height: 110px/,
    );
    expect(payMountCss).toMatch(
      /\[data-method="stripe"\] \.gafapay-form__group:not\(\.is-checkbox\) \{[^}]*min-height: 110px/,
    );
  });

  it("separa la tarjeta guardada del campo nuevo (GafaPay trae row-gap: 0)", () => {
    expect(payMountCss).toMatch(
      /\[data-method="stripe"\] \.gafapay-elements__container \{[^}]*gap: 0\.85rem/,
    );
  });

  it("rotula la tarjeta nueva como la guardada rotula su marca", () => {
    expect(payMountCss).toContain('content: "Nueva tarjeta"');
  });

  /*
   * El div `.StripeElement` no trae ancho propio: dentro de un contenedor flex
   * se encoge a 0 y el iframe de Stripe se ve como una caja vacía.
   */
  it("no mete el campo de Stripe en un contenedor flex y le da ancho", () => {
    expect(payMountCss).toMatch(/\.gafa-checkout-paymount \.StripeElement \{[^}]*width: 100%/);
    const stripeGroup = payMountCss.match(
      /\[data-method="stripe"\] \.gafapay-form__group:not\(\.is-checkbox\) \{[^}]*\}/,
    )?.[0];
    expect(stripeGroup).toBeTruthy();
    expect(stripeGroup).not.toContain("display: flex");
  });
});
