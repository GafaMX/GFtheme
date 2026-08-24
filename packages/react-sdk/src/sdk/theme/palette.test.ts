import { describe, expect, it } from "vitest";
import { buildPalette } from "./palette";

describe("buildPalette surface overrides", () => {
  it("respeta surface/background/text si el socio los manda (WP oscuro)", () => {
    const palette = buildPalette(
      {
        brand: "#dae343",
        background: "#000000",
        surface: "#000000",
        text: "#FFFFFF",
      },
      "dark",
    );

    expect(palette.background).toBe("#000000");
    expect(palette.surface).toBe("#000000");
    expect(palette.text).toBe("#FFFFFF");
    expect(palette.brand.toLowerCase()).not.toBe("#000000");
  });

  it("sigue derivando superficies cuando no hay override", () => {
    const palette = buildPalette({ brand: "#dae343" }, "dark");
    expect(palette.surface).toMatch(/^hsl\(/);
    expect(palette.background).toMatch(/^hsl\(/);
  });
});
