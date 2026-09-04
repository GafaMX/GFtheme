import { afterEach, describe, expect, it } from "vitest";
import {
  readHostColorScheme,
  resolveActiveColorScheme,
  resolveSdkColorScheme,
  schemeFromCssColor,
  schemeFromToken,
  withHostSurfaceVars,
} from "./hostColorScheme";

describe("hostColorScheme", () => {
  afterEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("--sdk-background-color");
    document.documentElement.style.removeProperty("--sdk-modal-bg");
    document.documentElement.style.removeProperty("--sdk-text-color");
    document.body.className = "";
    localStorage.removeItem("fitspin-theme");
  });

  it("reconoce html.fitspin-dark (Buq-Webs / Fitspin)", () => {
    document.documentElement.className = "fitspin-dark";
    expect(readHostColorScheme(document)).toBe("dark");
  });

  it("lee localStorage fitspin-theme si el class aún no está (useEffect de Fitspin)", () => {
    localStorage.setItem("fitspin-theme", "dark");
    expect(readHostColorScheme(document)).toBe("dark");
  });

  it("sin marca de la página no inventa un scheme", () => {
    expect(readHostColorScheme(document)).toBeNull();
    expect(schemeFromToken("")).toBeNull();
  });

  it("un --sdk-background-color oscuro cuenta como dark del overlay", () => {
    document.documentElement.style.setProperty("--sdk-background-color", "#181818");
    expect(readHostColorScheme(document)).toBe("dark");
    expect(schemeFromCssColor("#ffffff")).toBe("light");
    expect(schemeFromCssColor("#0b0b0b")).toBe("dark");
  });

  it("un --sdk-background-color blanco no tapa un THEME.dark (no devuelve light)", () => {
    document.documentElement.style.setProperty("--sdk-background-color", "#ffffff");
    document.documentElement.style.setProperty("--sdk-text-color", "#111111");
    expect(readHostColorScheme(document)).toBeNull();
  });

  it("lee data-theme en body", () => {
    document.body.setAttribute("data-theme", "light");
    expect(readHostColorScheme(document)).toBe("light");
  });

  it("la clase de la página le gana al THEME.colorScheme light del embed", () => {
    expect(
      resolveActiveColorScheme({
        hostScheme: "dark",
        preference: "light",
        osScheme: "light",
      }),
    ).toBe("dark");
    expect(
      resolveActiveColorScheme({
        hostScheme: null,
        preference: "light",
        osScheme: "dark",
      }),
    ).toBe("light");
  });

  it("con THEME locked dark ignora host light y prefers-color-scheme", () => {
    expect(
      resolveSdkColorScheme({
        colorScheme: "dark",
        allowUserColorScheme: false,
        storedPreference: "light",
        hostScheme: "light",
        osScheme: "light",
      }),
    ).toBe("dark");
  });

  it("con THEME locked light ignora host dark y preferencia guardada", () => {
    expect(
      resolveSdkColorScheme({
        colorScheme: "light",
        allowUserColorScheme: false,
        storedPreference: "dark",
        hostScheme: "dark",
        osScheme: "dark",
      }),
    ).toBe("light");
  });

  it("sin lock el host sigue ganando (Fitspin)", () => {
    expect(
      resolveSdkColorScheme({
        colorScheme: "light",
        allowUserColorScheme: true,
        storedPreference: "light",
        hostScheme: "dark",
        osScheme: "light",
      }),
    ).toBe("dark");
  });

  it("las superficies del SDK delegan en --sdk-* del overlay de Fitspin", () => {
    const vars = withHostSurfaceVars({
      "--gafa-color-text": "#111111",
      "--gafa-color-background": "#fafafa",
      "--gafa-color-surface": "#ffffff",
      "--gafa-color-surface-raised": "#f6f6f4",
      "--gafa-color-border": "#eee",
      "--gafa-color-overlay": "hsl(0 0% 0% / 0.7)",
    });
    expect(vars["--gafa-color-text"]).toBe("var(--sdk-text-color, #111111)");
    expect(vars["--gafa-color-surface"]).toBe("var(--sdk-background-color, #ffffff)");
    expect(vars["--gafa-color-background"]).toBe("var(--sdk-modal-bg, #fafafa)");
  });
});
