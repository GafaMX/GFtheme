import { afterEach, describe, expect, it } from "vitest";
import { readHostColorScheme, resolveActiveColorScheme, schemeFromToken } from "./hostColorScheme";

describe("hostColorScheme", () => {
  afterEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.body.className = "";
  });

  it("reconoce html.fitspin-dark (Buq-Webs / Fitspin)", () => {
    document.documentElement.className = "fitspin-dark";
    expect(readHostColorScheme(document)).toBe("dark");
  });

  it("sin marca de la página no inventa un scheme", () => {
    expect(readHostColorScheme(document)).toBeNull();
    expect(schemeFromToken("")).toBeNull();
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
});
