import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const themeCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "theme.css"),
  "utf8",
);

const widgetsCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../widgets/widgets.css"),
  "utf8",
);

describe("theme CSS isolation vs GafaPay", () => {
  it("no resetea botones/svg de la isla de PayPal (gafa-pay-native)", () => {
    expect(themeCss).toContain("button:not(.gafa-pay-native *)");
    expect(themeCss).toContain("svg[stroke]:not([fill]):not(.gafa-pay-native *)");
    expect(themeCss).toContain("input:not(.gafa-pay-native *)");
    expect(themeCss).toContain("select:not(.gafa-pay-native *)");
    expect(themeCss).toMatch(/box-sizing:\s*content-box/);
  });
});

describe("theme CSS isolation vs host (Elementor / Hello)", () => {
  it("no usa all:revert (tumba .gafa-sdk-button)", () => {
    const withoutComments = themeCss.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(withoutComments).not.toMatch(/all:\s*revert/);
  });

  it("sube especificidad con .gafa-sdk triple para ganar al kit de Elementor", () => {
    expect(themeCss).toContain(".gafa-sdk.gafa-sdk.gafa-sdk button");
    expect(themeCss).toContain("border: var(--gafa-control-border, 0 solid transparent) !important");
    expect(themeCss).toContain("color: var(--gafa-control-fg, inherit) !important");
  });

  it("no aplasta checkbox/radio del checkout con el reset de campos", () => {
    expect(themeCss).toContain('input:not([type="checkbox"]):not([type="radio"])');
  });

  it("bloquea fondo de headings y max-width de img del tema", () => {
    expect(themeCss).toContain("background-color: transparent !important");
    expect(themeCss).toContain("max-width: var(--gafa-img-max-width, none) !important");
  });

  it("pinta el focus del SDK, no el outline naranja de WP", () => {
    expect(themeCss).toContain("outline: 2px solid var(--gafa-color-accent) !important");
  });

  it("el texto secundario usa --gafa-fg para no heredar el gris oscuro del tema", () => {
    expect(themeCss).toContain("color: var(--gafa-fg, inherit) !important");
    expect(themeCss).toContain("color: var(--gafa-fg, var(--gafa-color-text)) !important");
    expect(widgetsCss).toMatch(/\.gafa-meeting-detail[\s\S]{0,280}--gafa-fg:\s*var\(--gafa-color-muted-text\)/);
    expect(widgetsCss).toMatch(/\.gafa-sdk-kicker[\s\S]{0,120}--gafa-fg:\s*var\(--gafa-color-muted-text\)/);
  });

  it("bloquea padding/ancho de flechas, X y dias para que Elementor no los aplaste", () => {
    expect(themeCss).toContain(".gafa-icon-button");
    expect(themeCss).toContain(".gafa-reservation-close");
    expect(themeCss).toContain(".gafa-checkout__line-remove");
    expect(themeCss).toContain(".gafa-datepicker__day");
    expect(themeCss).toContain("padding: var(--gafa-control-padding, 0px) !important");
    expect(themeCss).toContain("width: var(--gafa-control-width, 32px) !important");
  });

  it("el buscador del checkout y la X de quitar producto no los infla Elementor", () => {
    expect(themeCss).toContain(".gafa-checkout-search");
    expect(themeCss).toMatch(/\.gafa-checkout-search:not\(\.gafa-pay-native \*\) \{[\s\S]{0,280}height:\s*32px/);
    expect(themeCss).toMatch(/\.gafa-checkout__line-remove:not\(\.gafa-pay-native \*\) \{[\s\S]{0,120}overflow:\s*visible/);
    expect(widgetsCss).toMatch(/\.gafa-checkout-search \{[\s\S]{0,420}height:\s*32px/);
    expect(widgetsCss).toMatch(/\.gafa-checkout-search \{[\s\S]{0,420}--gafa-search-width:\s*92px/);
  });

  it("el calendario mensual tiene tope de ancho, no se estira al contenedor", () => {
    expect(widgetsCss).toMatch(/\.gafa-datepicker \{[\s\S]{0,400}width:\s*264px/);
    expect(widgetsCss).toMatch(/\.gafa-datepicker__day \{[\s\S]{0,500}width:\s*30px/);
  });

  it("en dark no apaga los dias pasados del datepicker ni infla los botones", () => {
    expect(widgetsCss).toMatch(
      /\.gafa-datepicker__day:disabled[\s\S]{0,500}opacity:\s*1/,
    );
    expect(widgetsCss).not.toMatch(/\.gafa-datepicker__day:disabled[\s\S]{0,200}opacity:\s*0\.3/);
    expect(widgetsCss).toMatch(/\.gafa-sdk-button[\s\S]{0,280}min-height:\s*40px/);
    expect(widgetsCss).toMatch(/\.gafa-checkout-product__add[\s\S]{0,400}min-height:\s*34px/);
  });

  it("asigna borde de control en las cards y el Hoy del calendario", () => {
    expect(widgetsCss).toContain(".gafa-meeting-card");
    expect(widgetsCss).toMatch(/\.gafa-meeting-card[\s\S]{0,280}--gafa-control-border:\s*1px solid var\(--gafa-color-border\)/);
    expect(widgetsCss).toMatch(/\.gafa-calendar-today[\s\S]{0,280}--gafa-control-border:\s*1px solid var\(--gafa-color-border\)/);
    expect(widgetsCss).toMatch(/\.gafa-sdk-button[\s\S]{0,280}--gafa-control-fg:\s*var\(--gafa-color-primary-text\)/);
  });
});
