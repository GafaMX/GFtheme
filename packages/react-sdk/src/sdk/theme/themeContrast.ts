import { luminanceFromCssColor } from "./hostColorScheme";
import type { ResolvedPalette } from "./palette";

export type Srgb = { r: number; g: number; b: number };

function hueToRgb(p: number, q: number, t: number): number {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
}

function hslToSrgb(h: number, s: number, l: number): Srgb {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

/** Hex (`#rgb` / `#rrggbb`) or `hsl(h s% l%)` / `rgb()`. */
export function parseCssRgb(raw: string): Srgb | null {
  const value = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const body = hex[1].length === 3 ? hex[1].split("").map((c) => c + c).join("") : hex[1];
    return {
      r: Number.parseInt(body.slice(0, 2), 16),
      g: Number.parseInt(body.slice(2, 4), 16),
      b: Number.parseInt(body.slice(4, 6), 16),
    };
  }
  const hsl = value.match(/hsl\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  if (hsl) {
    return hslToSrgb(Number(hsl[1]) / 360, Number(hsl[2]) / 100, Number(hsl[3]) / 100);
  }
  const rgb = value.match(/rgba?\(\s*([0-9.%]+)\s*[, ]\s*([0-9.%]+)\s*[, ]\s*([0-9.%]+)/i);
  if (rgb) {
    const channel = (token: string) =>
      token.endsWith("%") ? (Number.parseFloat(token) / 100) * 255 : Number.parseFloat(token);
    const r = channel(rgb[1]);
    const g = channel(rgb[2]);
    const b = channel(rgb[3]);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

function srgbChannelToLinear(channel: number): number {
  const x = channel / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

export function wcagRelativeLuminance(color: string): number | null {
  const rgb = parseCssRgb(color);
  if (!rgb) return null;
  return 0.2126 * srgbChannelToLinear(rgb.r) + 0.7152 * srgbChannelToLinear(rgb.g) + 0.0722 * srgbChannelToLinear(rgb.b);
}

/** Same mix as CSS `color-mix(in srgb, A p%, B)`. `amountA` is 0–1. */
export function mixSrgb(a: string, b: string, amountA: number): string | null {
  const left = parseCssRgb(a);
  const right = parseCssRgb(b);
  if (!left || !right) return null;
  const mix = (x: number, y: number) => Math.round(x * amountA + y * (1 - amountA));
  const r = mix(left.r, right.r);
  const g = mix(left.g, right.g);
  const bChan = mix(left.b, right.b);
  return `#${[r, g, bChan].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("")}`;
}

export function wcagContrastRatio(foreground: string, background: string): number | null {
  const a = wcagRelativeLuminance(foreground);
  const b = wcagRelativeLuminance(background);
  if (a == null || b == null) return null;
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

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
