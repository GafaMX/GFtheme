import { describe, expect, it } from "vitest";
import { buildPalette } from "./palette";

function lightness(color: string): number {
  const match = color.match(/hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
  if (!match) throw new Error(`expected hsl(), got ${color}`);
  return Number(match[3]);
}

describe("dark palette contrast", () => {
  it("con un brand lima, el texto muted no se pierde sobre la superficie", () => {
    const palette = buildPalette({ brand: "#dae343" }, "dark");

    expect(lightness(palette.mutedText)).toBeGreaterThanOrEqual(74);
    expect(lightness(palette.mutedText) - lightness(palette.surface)).toBeGreaterThanOrEqual(55);
    expect(lightness(palette.border) - lightness(palette.surface)).toBeGreaterThanOrEqual(14);
  });

  it("el CTA lima claro sigue pidiendo texto oscuro", () => {
    const palette = buildPalette({ brand: "#dae343" }, "dark");
    expect(palette.brandContrast).toBe("#0b0b0d");
  });
});

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
    expect(palette.inputBackground).toBe(palette.surface);
    expect(palette.inputText).toBe(palette.text);
    expect(palette.inputBorder).toBe(palette.border);
  });

  it("los tokens de input se pueden pisar aparte de la superficie", () => {
    const palette = buildPalette(
      {
        brand: "#F3D15E",
        surface: "#1E2444",
        text: "#FFFFFF",
        border: "#394165",
        inputBackground: "#171C35",
        inputText: "#AEB4CB",
        inputBorder: "#252C50",
      },
      "dark",
    );
    expect(palette.surface).toBe("#1E2444");
    expect(palette.inputBackground).toBe("#171C35");
    expect(palette.inputText).toBe("#AEB4CB");
    expect(palette.inputBorder).toBe("#252C50");
  });
});
