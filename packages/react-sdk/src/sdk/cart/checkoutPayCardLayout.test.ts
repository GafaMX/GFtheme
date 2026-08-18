import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const widgetsCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../widgets/widgets.css"),
  "utf8",
);

describe("checkout Stripe saved-card layout", () => {
  it("acota la isla de Stripe al ancho de la tarjeta guardada y deja hueco", () => {
    expect(widgetsCss).toContain("--gafa-pay-card-width: 200px");
    expect(widgetsCss).toContain("min-height: 110px");
    expect(widgetsCss).toMatch(/\[data-method="stripe"\] \.gafa-checkout-paymount__island/);
  });
});
