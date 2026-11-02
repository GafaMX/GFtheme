import { luminanceFromCssColor } from "./hostColorScheme";
import type { ResolvedPalette } from "./palette";

function luminanceFromHsl(raw: string): number | null {
  const match = raw.match(/hsl\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  if (!match) return null;
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;

  const hueToRgb = (p: number, q: number, t: number) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const a = luminanceFromCssColor(foreground) ?? luminanceFromHsl(foreground);
  const b = luminanceFromCssColor(background) ?? luminanceFromHsl(background);
  if (a == null || b == null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Avisos suaves. Nunca rechaza un THEME: un dorado sobre navy puede
 * quedar por debajo de 4.5 y el estudio igual lo quiere.
 */
export function collectThemeContrastWarnings(palette: ResolvedPalette): string[] {
  const warnings: string[] = [];
  const check = (fg: string, bg: string, label: string, min = 4.5) => {
    const ratio = contrastRatio(fg, bg);
    if (ratio != null && ratio < min) {
      warnings.push(`${label} ${ratio.toFixed(2)} < ${min}`);
    }
  };

  check(palette.text, palette.background, "text/background");
  check(palette.text, palette.surface, "text/surface");
  check(palette.inputText, palette.inputBackground, "input");
  check(palette.brandContrast, palette.brand, "button");
  return warnings;
}
