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
