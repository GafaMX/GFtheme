import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { legacyOptionsToConfig } from "../config";
import { SdkBodyOverlay } from "../widgets/SdkBodyOverlay";
import { buildPalette } from "./palette";
import { collectThemeContrastWarnings, contrastRatio } from "./themeContrast";
import {
  THEME_COLOR_CSS_VARS,
  ThemeProvider,
  themePreferenceStorageKey,
  themeToCssVariables,
  type GafaBrandTheme,
} from "./theme";

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-theme");
  document.body.removeAttribute("data-theme");
  localStorage.clear();
});

const THE_BASE_COLORS = {
  brand: "#F3D15E",
  accent: "#F3D15E",
  background: "#171C35",
  surface: "#1E2444",
  surfaceRaised: "#252C50",
  text: "#FFFFFF",
  mutedText: "#AEB4CB",
  border: "#394165",
  inputBackground: "#171C35",
  inputText: "#FFFFFF",
  inputBorder: "#394165",
} as const;

const THE_BASE_THEME: GafaBrandTheme = {
  colorScheme: "dark",
  allowUserColorScheme: false,
  colors: THE_BASE_COLORS,
};

function wrap(ui: ReactNode, theme: GafaBrandTheme, scope?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme} storageScope={scope}>
        {ui}
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function expectDefinedTokens(vars: Record<string, string>) {
  for (const name of THEME_COLOR_CSS_VARS) {
    expect(vars[name], name).toBeTruthy();
    expect(vars[name]).not.toBe("undefined");
    expect(vars[name].trim()).not.toBe("");
  }
}

describe("THEME.colors: defaults y personalización", () => {
  it("1. dark predeterminado sin colors: paleta derivada, no navy de The Base", () => {
    const vars = themeToCssVariables({ colorScheme: "dark" }, "dark", { followHostSurface: false });
    expectDefinedTokens(vars);
    expect(vars["--gafa-color-background"]).toMatch(/^hsl\(/);
    expect(vars["--gafa-color-background"]).not.toBe("#171C35");
    expect(vars["--gafa-color-brand"]).toBe(vars["--gafa-color-primary"]);
    const palette = buildPalette({ brand: "#111827" }, "dark");
    expect(contrastRatio(palette.text, palette.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.inputText, palette.inputBackground)).toBeGreaterThanOrEqual(4.5);
  });

  it("2. light predeterminado sin colors: superficies claras", () => {
    const vars = themeToCssVariables({ colorScheme: "light" }, "light", { followHostSurface: false });
    expectDefinedTokens(vars);
    expect(vars["--gafa-color-surface"]).toBe("#ffffff");
    expect(vars["--gafa-color-input-background"]).toBe("#ffffff");
    expect(vars["--gafa-color-background"]).not.toBe("#171C35");
    const warnings = collectThemeContrastWarnings(buildPalette({ brand: "#111827" }, "light"));
    expect(warnings).toEqual([]);
  });

  it("3. dark con fondos y superficies personalizados (The Base)", () => {
    const vars = themeToCssVariables(THE_BASE_THEME, "dark", { followHostSurface: false });
    expect(vars["--gafa-color-background"]).toBe("#171C35");
    expect(vars["--gafa-color-surface"]).toBe("#1E2444");
    expect(vars["--gafa-color-surface-raised"]).toBe("#252C50");
    expect(vars["--gafa-color-text"]).toBe("#FFFFFF");
    expect(vars["--gafa-color-muted-text"]).toBe("#AEB4CB");
    expect(vars["--gafa-color-border"]).toBe("#394165");
    expect(vars["--gafa-color-input-background"]).toBe("#171C35");
    expect(vars["--gafa-color-input-text"]).toBe("#FFFFFF");
    expect(vars["--gafa-color-input-border"]).toBe("#394165");
    expect(vars["--gafa-color-brand"]).toBe(vars["--gafa-color-primary"]);
    expect(vars).not.toMatchObject({ "--gafa-color-surface": expect.stringContaining("var(--sdk-") });
  });

  it("4. light con fondos y superficies personalizados", () => {
    const vars = themeToCssVariables(
      {
        colorScheme: "light",
        allowUserColorScheme: false,
        colors: {
          brand: "#0F766E",
          accent: "#14B8A6",
          background: "#F4F1EA",
          surface: "#FFFCF7",
          surfaceRaised: "#FFFFFF",
          text: "#1A1814",
          mutedText: "#6B6458",
          border: "#E4DDD0",
          inputBackground: "#FFFCF7",
        },
      },
      "light",
      { followHostSurface: false },
    );
    expect(vars["--gafa-color-background"]).toBe("#F4F1EA");
    expect(vars["--gafa-color-surface"]).toBe("#FFFCF7");
    expect(vars["--gafa-color-text"]).toBe("#1A1814");
    expect(vars["--gafa-color-input-background"]).toBe("#FFFCF7");
    expect(vars["--gafa-color-input-text"]).toBe("#1A1814");
    expect(vars["--gafa-color-input-border"]).toBe("#E4DDD0");
  });

  it("5. cuenta, reserva y checkout reciben la misma paleta en el primer render", () => {
    wrap(
      <>
        <div data-gf-theme="meetings-calendar">calendario</div>
        <SdkBodyOverlay className="gafa-account-overlay">cuenta</SdkBodyOverlay>
        <SdkBodyOverlay className="gafa-reservation-overlay">reserva</SdkBodyOverlay>
        <SdkBodyOverlay className="gafa-checkout-overlay">checkout</SdkBodyOverlay>
      </>,
      THE_BASE_THEME,
      "171:203",
    );

    const calendar = document.querySelector(".gafa-sdk");
    const account = document.body.querySelector(".gafa-account-overlay");
    const reservation = document.body.querySelector(".gafa-reservation-overlay");
    const checkout = document.body.querySelector(".gafa-checkout-overlay");

    const styles = [calendar, account, reservation, checkout].map((node) => node?.getAttribute("style") ?? "");
    for (const style of styles) {
      expect(style).toContain("--gafa-color-background: #171C35");
      expect(style).toContain("--gafa-color-surface: #1E2444");
      expect(style).toContain("--gafa-color-input-background: #171C35");
      expect(style).not.toContain("var(--sdk-text-color");
    }
    expect(account?.getAttribute("data-color-scheme")).toBe("dark");
    expect(reservation?.getAttribute("data-color-scheme")).toBe("dark");
    expect(checkout?.getAttribute("data-color-scheme")).toBe("dark");
  });

  it("6. el theme locked se mantiene al remount (reload) y no comparte key entre compañías", () => {
    localStorage.setItem(themePreferenceStorageKey("171:203"), "light");
    localStorage.setItem(themePreferenceStorageKey("1:fitspin"), "light");

    wrap(<span>marca-a</span>, THE_BASE_THEME, "171:203");
    expect(document.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("dark");
    expect(document.querySelector(".gafa-sdk")?.getAttribute("style")).toContain("#171C35");
    cleanup();

    wrap(<span>marca-a-otra-pestana</span>, THE_BASE_THEME, "171:203");
    expect(document.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("dark");
    expect(document.querySelector(".gafa-sdk")?.getAttribute("style")).toContain("#171C35");
    expect(localStorage.getItem(themePreferenceStorageKey("1:fitspin"))).toBe("light");
  });

  it("7. primer paint del overlay ya trae la paleta de marca (sin flash del default)", () => {
    wrap(<SdkBodyOverlay className="gafa-checkout-overlay">pago</SdkBodyOverlay>, THE_BASE_THEME, "171:203");
    const overlay = document.body.querySelector(".gafa-checkout-overlay");
    expect(overlay?.getAttribute("style")).toContain("--gafa-color-background: #171C35");
    expect(overlay?.getAttribute("style")).not.toMatch(/--gafa-color-background:\s*hsl\(/);
  });

  it("8. cambiar el theme del documento no afecta un SDK bloqueado", () => {
    document.documentElement.dataset.theme = "light";
    document.body.setAttribute("data-theme", "light");
    document.documentElement.className = "fitspin-dark";

    wrap(<SdkBodyOverlay className="gafa-account-overlay">cuenta</SdkBodyOverlay>, THE_BASE_THEME, "171:203");

    const overlay = document.body.querySelector(".gafa-account-overlay");
    expect(overlay?.getAttribute("data-color-scheme")).toBe("dark");
    expect(overlay?.getAttribute("style")).toContain("#171C35");
    expect(overlay?.getAttribute("style")).not.toContain("var(--sdk-");
  });

  it("9. tipografía, radios y medidas no cambian al tocar solo THEME.colors", () => {
    const without = themeToCssVariables({ colorScheme: "dark", allowUserColorScheme: false }, "dark", {
      followHostSurface: false,
    });
    const withColors = themeToCssVariables(THE_BASE_THEME, "dark", { followHostSurface: false });

    for (const key of [
      "--gafa-font-body",
      "--gafa-font-heading",
      "--gafa-radius-sm",
      "--gafa-radius-md",
      "--gafa-radius-lg",
      "--gafa-radius-pill",
      "--gafa-logo-max-width",
      "--gafa-logo-max-height",
    ]) {
      expect(withColors[key]).toBe(without[key]);
    }
    expect(withColors["--gafa-color-background"]).not.toBe(without["--gafa-color-background"]);
  });

  it("10. configs viejas con solo brand y accent siguen funcionando", () => {
    const vars = themeToCssVariables(
      { colors: { brand: "#f2b705", accent: "#111827" } },
      "light",
      { followHostSurface: false },
    );
    expectDefinedTokens(vars);
    expect(vars["--gafa-color-brand"]).toBe(vars["--gafa-color-primary"]);
    expect(vars["--gafa-color-accent"]).toBeTruthy();
    expect(vars["--gafa-color-surface"]).toBe("#ffffff");
    expect(vars["--gafa-color-input-background"]).toBe(vars["--gafa-color-surface"]);
  });

  it("colors.primary se acepta como alias de brand", () => {
    const withPrimary = themeToCssVariables(
      { colors: { primary: "#dae343" } } as unknown as GafaBrandTheme,
      "light",
      { followHostSurface: false },
    );
    const withBrand = themeToCssVariables(
      { colors: { brand: "#dae343" } },
      "light",
      { followHostSurface: false },
    );
    expect(withPrimary["--gafa-color-primary"]).toBe(withBrand["--gafa-color-primary"]);
    expect(withPrimary["--gafa-color-brand"]).toBe(withBrand["--gafa-color-brand"]);
  });
});

describe("THEME.colors: fallbacks y contrato", () => {
  it("tokens vacíos no quedan transparentes", () => {
    const palette = buildPalette(
      {
        brand: "#F3D15E",
        background: "   ",
        surface: "",
        inputBackground: "",
      },
      "dark",
    );
    expect(palette.background).toMatch(/^hsl\(/);
    expect(palette.surface).toMatch(/^hsl\(/);
    expect(palette.inputBackground).toBe(palette.surface);
    expect(palette.inputText).toBe(palette.text);
    expect(palette.inputBorder).toBe(palette.border);
  });

  it("un contraste bajo no rechaza el THEME (dorado sobre navy)", () => {
    const palette = buildPalette(THE_BASE_COLORS, "dark");
    expect(palette.background).toBe("#171C35");
    const warnings = collectThemeContrastWarnings(palette);
    expect(Array.isArray(warnings)).toBe(true);
    expect(palette.surface).toBe("#1E2444");
  });

  it("data-gf-options.THEME.colors llega al config", () => {
    const config = legacyOptionsToConfig({
      COMPANY_ID: 171,
      API_CLIENT: "203",
      THEME: {
        colorScheme: "dark",
        allowUserColorScheme: false,
        colors: THE_BASE_COLORS,
      },
    });
    expect(config.theme?.colors?.background).toBe("#171C35");
    expect(config.theme?.colors?.inputBackground).toBe("#171C35");
    expect(config.theme?.allowUserColorScheme).toBe(false);
  });
});
