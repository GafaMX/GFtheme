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

  it("el logo del estudio no lo infla Elementor a width 100%", () => {
    expect(themeCss).toMatch(
      /img\.gafa-studio-logo \{[\s\S]{0,280}max-height:\s*40px !important/,
    );
    expect(themeCss).toMatch(
      /img\.gafa-studio-logo \{[\s\S]{0,280}max-width:\s*120px !important/,
    );
    expect(themeCss).toMatch(
      /img\.gafa-studio-logo \{[\s\S]{0,280}width:\s*auto !important/,
    );
    expect(widgetsCss).toMatch(/\.gafa-studio-logo \{[\s\S]{0,280}max-height:\s*40px/);
    expect(widgetsCss).toMatch(/\.gafa-studio-logo \{[\s\S]{0,280}max-width:\s*120px/);
  });

  it("el login del checkout llena la columna, no se queda en 26rem", () => {
    expect(widgetsCss).toMatch(/\.gafa-checkout-auth \{[\s\S]{0,160}max-width:\s*none/);
    expect(widgetsCss).toMatch(/\.gafa-checkout-auth \{[\s\S]{0,200}width:\s*100%/);
    expect(widgetsCss).toMatch(/\.gafa-checkout-auth \{[\s\S]{0,200}padding-inline:\s*1\.5rem/);
    expect(widgetsCss).not.toMatch(/\.gafa-checkout-auth \{\s*max-width:\s*26rem/);
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
    expect(widgetsCss).toMatch(/\.gafa-checkout__toolbar \{[\s\S]{0,200}flex-wrap:\s*nowrap/);
    expect(themeCss).toMatch(/\.gafa-checkout__toolbar:not\(\.gafa-pay-native \*\) \{[\s\S]{0,200}flex-wrap:\s*nowrap/);
    expect(widgetsCss).toMatch(
      /\.gafa-checkout__cart:not\(\[data-open="true"\]\) \.gafa-checkout__lines/,
    );
    expect(widgetsCss).toMatch(
      /\.gafa-checkout:not\(\[data-step="thanks"\]\) \.gafa-checkout__cart-toggle \{[\s\S]{0,80}display:\s*flex/,
    );
    expect(widgetsCss).toMatch(/\.gafa-checkout-search:focus-within \{[\s\S]{0,160}--gafa-search-width:\s*72px/);
    expect(themeCss).toMatch(
      /\.gafa-checkout-search:focus-within:not\(\.gafa-pay-native \*\) \{[\s\S]{0,200}min-width:\s*108px/,
    );
  });

  it("el calendario mensual tiene tope de ancho, no se estira al contenedor", () => {
    expect(widgetsCss).toMatch(/\.gafa-datepicker \{[\s\S]{0,400}width:\s*264px/);
    expect(widgetsCss).toMatch(/\.gafa-datepicker__day \{[\s\S]{0,500}width:\s*30px/);
  });

  it("los checks del checkout son redondos y no los aplasta Elementor", () => {
    expect(widgetsCss).toMatch(/\.gafa-check-box[\s\S]{0,280}border-radius:\s*8px/);
    expect(themeCss).toMatch(/\.gafa-check-box:not\(\.gafa-pay-native \*\) \{[\s\S]{0,280}border-radius:\s*8px/);
    expect(widgetsCss).toMatch(/\.gafa-checkout-membership:not\(\[data-visible="true"\]\)|\.gafa-checkout-membership \{[\s\S]{0,80}display:\s*none/);
  });

  it("en dark no apaga los dias pasados del datepicker ni infla los botones", () => {
    expect(widgetsCss).toMatch(
      /\.gafa-datepicker__day:disabled[\s\S]{0,500}opacity:\s*1/,
    );
    expect(widgetsCss).not.toMatch(/\.gafa-datepicker__day:disabled[\s\S]{0,200}opacity:\s*0\.3/);
    expect(widgetsCss).toMatch(/\.gafa-sdk-button[\s\S]{0,280}min-height:\s*40px/);
    expect(widgetsCss).toMatch(/\.gafa-checkout-product__add[\s\S]{0,400}min-height:\s*34px/);
  });

  it("el carrito del header es un círculo de marca, no una pastilla gris", () => {
    expect(widgetsCss).toMatch(
      /\.gafa-header-cart \{[\s\S]{0,520}--gafa-control-bg:\s*var\(--gafa-color-primary\)/,
    );
    expect(widgetsCss).toMatch(/\.gafa-header-cart \{[\s\S]{0,720}width:\s*38px/);
    expect(widgetsCss).toMatch(/\.gafa-header-cart \{[\s\S]{0,720}overflow:\s*visible/);
    expect(widgetsCss).toMatch(
      /\.gafa-header-cart__count \{[\s\S]{0,420}position:\s*absolute/,
    );
    expect(themeCss).toMatch(
      /\.gafa-header-cart:not\(\.gafa-pay-native \*\) \{[\s\S]{0,280}overflow:\s*visible/,
    );
  });

  it("el puntito de conectado se asoma un poco en el borde, sin flotar fuera del círculo", () => {
    expect(widgetsCss).toMatch(
      /\.gafa-header-account \{\n  --gafa-control-padding:[\s\S]{0,500}overflow:\s*visible/,
    );
    expect(widgetsCss).toMatch(/\.gafa-header-account__dot \{[\s\S]{0,280}top:\s*3px/);
    expect(widgetsCss).toMatch(/\.gafa-header-account__dot \{[\s\S]{0,280}right:\s*3px/);
    expect(widgetsCss).toMatch(/\.gafa-header-account__dot \{[\s\S]{0,280}width:\s*10px/);
    expect(themeCss).toMatch(/\.gafa-header-account__dot:not\(\.gafa-pay-native \*\) \{[\s\S]{0,200}top:\s*3px/);
    expect(themeCss).toMatch(/\.gafa-header-account__dot:not\(\.gafa-pay-native \*\) \{[\s\S]{0,200}width:\s*10px/);
  });

  it("Código válido del GiftCard usa --gafa-type-size chico, no hereda el total del checkout", () => {
    expect(widgetsCss).toMatch(/\.gafa-checkout-promo \{[\s\S]{0,80}--gafa-type-size:\s*0\.8rem/);
    expect(widgetsCss).toMatch(
      /\.gafa-checkout-promo__applied \{[\s\S]{0,280}--gafa-type-size:\s*0\.8rem/,
    );
    expect(widgetsCss).toMatch(
      /\.gafa-checkout-promo__applied \{[\s\S]{0,280}--gafa-fg:\s*#15803d/,
    );
    expect(themeCss).toMatch(
      /\.gafa-checkout-promo__applied:not\(\.gafa-pay-native \*\) \{[\s\S]{0,400}font-size:\s*0\.8rem !important/,
    );
    expect(themeCss).toMatch(
      /\.gafa-checkout-promo__applied:not\(\.gafa-pay-native \*\) \{[\s\S]{0,400}font-family:\s*var\(--gafa-font-body\) !important/,
    );
  });

  it("la nota extra de la clase se trunca a una línea y la i compacta no es un botón", () => {
    expect(widgetsCss).toMatch(/\.gafa-meeting-desc \{[\s\S]{0,200}text-overflow:\s*ellipsis/);
    expect(widgetsCss).toMatch(/\.gafa-meeting-desc \{[\s\S]{0,200}white-space:\s*nowrap/);
    expect(widgetsCss).toMatch(/\.gafa-meeting-extra__mark \{[\s\S]{0,480}height:\s*16px/);
    expect(widgetsCss).toMatch(
      /\.gafa-reservation-hero \.gafa-reservation-notes \{[\s\S]{0,280}font-size:\s*0\.78rem/,
    );
    expect(widgetsCss).toMatch(
      /\.gafa-reservation-hero \.gafa-reservation-notes \{[\s\S]{0,280}text-transform:\s*uppercase/,
    );
    expect(widgetsCss).not.toMatch(
      /\.gafa-reservation-hero h3,\s*\.gafa-reservation-hero \.gafa-reservation-notes \{/,
    );
    expect(themeCss).toMatch(
      /\.gafa-reservation-hero \.gafa-reservation-notes:not\(\.gafa-pay-native \*\) \{[\s\S]{0,280}font-size:\s*0\.78rem !important/,
    );
  });

  it("el fancy oscuro es opaco y el tab activo de Paquetes usa el color de marca", () => {
    expect(widgetsCss).toMatch(
      /\.gafa-checkout \{[\s\S]{0,120}background:\s*var\(--gafa-color-modal/,
    );
    expect(widgetsCss).toMatch(
      /\.gafa-account-modal \{[\s\S]{0,120}background:\s*var\(--gafa-color-modal/,
    );
    expect(widgetsCss).toMatch(
      /\.gafa-checkout-tabs button\[data-active="true"\] \{[\s\S]{0,280}--gafa-control-bg:\s*var\(--gafa-color-primary\)/,
    );
    expect(widgetsCss).toMatch(
      /\.gafa-checkout-tabs button\[data-active="true"\] \{[\s\S]{0,320}--gafa-control-fg:\s*var\(--gafa-color-primary-text\)/,
    );
    expect(themeCss).toMatch(
      /\.gafa-checkout,[\s\S]{0,200}\.gafa-fancy-sheet[\s\S]{0,160}background:\s*var\(--gafa-color-modal/,
    );
    expect(themeCss).toMatch(
      /\.gafa-checkout-tabs button\[data-active="true"\]:not\(\.gafa-pay-native \*\) \{[\s\S]{0,280}background:\s*var\(--gafa-color-primary\)/,
    );
  });

  it("asigna borde de control en las cards y el Hoy del calendario", () => {
    expect(widgetsCss).toContain(".gafa-meeting-card");
    expect(widgetsCss).toMatch(/\.gafa-meeting-card[\s\S]{0,280}--gafa-control-border:\s*1px solid var\(--gafa-color-border\)/);
    expect(widgetsCss).toMatch(/\.gafa-calendar-today[\s\S]{0,280}--gafa-control-border:\s*1px solid var\(--gafa-color-border\)/);
    expect(widgetsCss).toMatch(/\.gafa-sdk-button[\s\S]{0,280}--gafa-control-fg:\s*var\(--gafa-color-primary-text\)/);
  });
});
