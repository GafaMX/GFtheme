import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { legacyOptionsToConfig } from "../config";
import {
  HEADER_ACCOUNT_CSS_VARS,
  resolveTheme,
  themeToCssVariables,
} from "./theme";

const widgetsCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../widgets/widgets.css"),
  "utf8",
);

const SAMPLE: Record<(typeof HEADER_ACCOUNT_CSS_VARS)[number], string> = {
  "--gafa-header-account-font-family": "Inter, sans-serif",
  "--gafa-header-account-font-size": "11px",
  "--gafa-header-account-font-weight": "500",
  "--gafa-header-account-letter-spacing": "0.22em",
  "--gafa-header-account-text-transform": "uppercase",
  "--gafa-header-account-line-height": "1",
  "--gafa-header-account-height": "48px",
  "--gafa-header-account-padding": "0 28px",
  "--gafa-header-account-background": "#8D6363",
  "--gafa-header-account-color": "#FFFFFF",
  "--gafa-header-account-border": "0",
  "--gafa-header-account-border-radius": "999px",
};

describe("THEME.headerControls", () => {
  it("sin headerControls no emite variables: el CSS conserva los defaults", () => {
    const vars = themeToCssVariables({ colorScheme: "light" }, "light", { followHostSurface: false });
    for (const name of HEADER_ACCOUNT_CSS_VARS) {
      expect(vars[name], name).toBeUndefined();
    }
    expect(widgetsCss).toContain("var(--gafa-header-account-font-family, inherit)");
    expect(widgetsCss).toContain("var(--gafa-header-account-font-size, 0.84rem)");
    expect(widgetsCss).toContain("var(--gafa-header-account-font-weight, 700)");
    expect(widgetsCss).toContain("var(--gafa-header-account-letter-spacing, normal)");
    expect(widgetsCss).toContain("var(--gafa-header-account-text-transform, none)");
    expect(widgetsCss).toContain("var(--gafa-header-account-line-height, inherit)");
    expect(widgetsCss).toContain("var(--gafa-header-account-height, 36px)");
    expect(widgetsCss).toContain("var(--gafa-header-account-padding, 0 0.9rem)");
    expect(widgetsCss).toContain("var(--gafa-header-account-background, var(--gafa-color-primary))");
    expect(widgetsCss).toContain("var(--gafa-header-account-color, var(--gafa-color-primary-text))");
    expect(widgetsCss).toContain("var(--gafa-header-account-border, none)");
    expect(widgetsCss).toContain("var(--gafa-header-account-border-radius, var(--gafa-radius-pill))");
  });

  it("cada option genera la variable oficial", () => {
    const vars = themeToCssVariables(
      {
        headerControls: {
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          lineHeight: "1",
          height: 48,
          padding: "0 28px",
          background: "#8D6363",
          color: "#FFFFFF",
          border: "0",
          borderRadius: "999px",
        },
      },
      "light",
      { followHostSurface: false },
    );
    for (const [name, value] of Object.entries(SAMPLE)) {
      expect(vars[name], name).toBe(value);
    }
  });

  it("\"\" y transform inválido caen al default (no se emite la var)", () => {
    const vars = themeToCssVariables(
      {
        headerControls: {
          fontSize: "   ",
          background: "",
          textTransform: "wide" as never,
          height: "",
        },
      },
      "dark",
      { followHostSurface: false },
    );
    expect(vars["--gafa-header-account-font-size"]).toBeUndefined();
    expect(vars["--gafa-header-account-background"]).toBeUndefined();
    expect(vars["--gafa-header-account-text-transform"]).toBeUndefined();
    expect(vars["--gafa-header-account-height"]).toBeUndefined();
  });

  it("los tokens explícitos tienen prioridad sobre el preset", () => {
    const resolved = resolveTheme({
      preset: "boutique",
      headerControls: { background: "#8D6363", color: "#fff" },
    });
    expect(resolved.headerControls.background).toBe("#8D6363");
    expect(resolved.headerControls.color).toBe("#fff");
  });

  it("data-gf-options THEME.headerControls llega al config", () => {
    const config = legacyOptionsToConfig({
      GAFA_FIT_URL: "https://example.gafa.fit",
      COMPANY_ID: 80,
      API_CLIENT: "demo",
      THEME: {
        headerControls: {
          fontSize: "11px",
          fontWeight: 500,
          height: "48px",
          background: "#8D6363",
        },
      },
    });
    expect(config.theme?.headerControls?.fontSize).toBe("11px");
    expect(config.theme?.headerControls?.fontWeight).toBe(500);
    expect(config.theme?.headerControls?.height).toBe("48px");
    expect(config.theme?.headerControls?.background).toBe("#8D6363");
  });

  it("el carrito no consume las vars del botón de cuenta", () => {
    expect(widgetsCss).toMatch(/\.gafa-header-cart \{[\s\S]{0,400}width:\s*38px/);
    expect(widgetsCss).not.toMatch(/\.gafa-header-cart \{[\s\S]{0,400}--gafa-header-account-/);
  });

  it("en mobile el label se oculta y el icono cae a 38px si no hay height", () => {
    expect(widgetsCss).toMatch(
      /@media \(max-width: 620px\) \{[\s\S]{0,200}\.gafa-header-account__label \{[\s\S]{0,80}display:\s*none/,
    );
    expect(widgetsCss).toContain("var(--gafa-header-account-height, 38px)");
  });

  it("la muralla anti-Elementor consume las vars oficiales", () => {
    const themeCss = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "theme.css"),
      "utf8",
    );
    expect(themeCss).toContain("height: var(--gafa-header-account-height, 36px)");
    expect(themeCss).toContain("height: var(--gafa-header-account-height, 38px)");
    expect(themeCss).toContain("font-family: var(--gafa-header-account-font-family, inherit)");
    expect(themeCss).toContain("font-weight: var(--gafa-header-account-font-weight, 700)");
  });
});
