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
  it("la tarjeta nueva y la guardada comparten ancho y padding", () => {
    expect(payMountCss).toMatch(
      /\.gafa-checkout-paymount \.card-list__item \{[^}]*padding: 0\.7rem 0\.8rem;[^}]*width: 100%/,
    );
    expect(payMountCss).toMatch(
      /\[data-method="stripe"\] \.gafapay-form__group:not\(\.is-checkbox\) \{[^}]*padding: 0\.7rem 0\.8rem;[^}]*width: 100%/,
    );
  });

  it("no deja que la isla desborde el panel de pago", () => {
    expect(payMountCss).toMatch(/\.gafa-checkout-paymount \{[^}]*min-width: 0/);
    expect(payMountCss).toMatch(/\.gafa-checkout-paymount__island \{[^}]*max-width: 100%/);
  });

  /*
   * theme.css pone content-box en la isla por el boton de PayPal. Con Stripe,
   * `width: 100%` + padding + borde se salia del panel y cortaba el `•••• 3002`.
   */
  it("devuelve border-box a la isla de Stripe, sin tocar la de PayPal", () => {
    const rule = payMountCss.match(
      /\.gafa-checkout-paymount\[data-method="stripe"\] \.gafa-pay-native,\s*\.gafa-checkout-paymount\[data-method="stripe"\] \.gafa-pay-native \* \{[^}]*\}/,
    )?.[0];
    expect(rule).toBeTruthy();
    expect(rule).toContain("box-sizing: border-box");
    expect(payMountCss).not.toMatch(/\[data-method="paypal"\][^{]*\{[^}]*box-sizing: border-box/);
  });

  /*
   * Stripe no usa `.gafapay-elements__cards` (eso es Conekta). Las tarjetas
   * guardadas y "Nueva tarjeta" son hermanos bajo `.gafapay-elements`, que
   * GafaPay deja en display:block sin gap. El hueco va en ese padre.
   */
  it("separa en Stripe la lista guardada del campo nuevo", () => {
    const stripeStack = payMountCss.match(
      /\[data-method="stripe"\] \.gafapay-elements \{[^}]*\}/,
    )?.[0];
    expect(stripeStack).toBeTruthy();
    expect(stripeStack).toContain("display: grid");
    expect(stripeStack).toContain("row-gap: var(--gafa-pay-card-gap)");
  });

  it("sigue separando el listado Conekta (.gafapay-elements__cards)", () => {
    expect(payMountCss).toMatch(
      /\.gafa-checkout-paymount \.gafapay-elements__cards \{[^}]*row-gap: 0\.85rem/,
    );
  });

  /*
   * StripeSources pinta un `.card-list__item` por source. GafaPay a ≥992px
   * las pone en 3 columnas de 200px; el checkout las apila a todo el ancho
   * con el mismo hueco que la tarjeta nueva.
   */
  it("apila N tarjetas guardadas en una columna con el mismo hueco", () => {
    const stripeList = payMountCss.match(
      /\[data-method="stripe"\] \.card-list \{[^}]*\}/,
    )?.[0];
    expect(stripeList).toBeTruthy();
    expect(stripeList).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(stripeList).toContain("row-gap: var(--gafa-pay-card-gap)");
    expect(payMountCss).toMatch(
      /@media screen and \(min-width: 992px\) \{[^}]*\[data-method="stripe"\] \.card-list \{[^}]*grid-template-columns: minmax\(0, 1fr\)/,
    );
  });

  it("apila el •••• bajo la marca en vez de mandarlo a la derecha", () => {
    expect(payMountCss).toMatch(
      /\.card-list__item > \.last4 \{[^}]*justify-items: start/,
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
