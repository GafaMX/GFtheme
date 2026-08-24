/**
 * Deriva una paleta completa a partir de MUY pocos colores base.
 *
 * La idea es que un socio configure `brand` (su color principal) y como mucho
 * `accent`, y que el SDK saque de ahi fondos, superficies, bordes, textos y
 * estados, en claro y en oscuro. Antes habia que declarar los 10 colores a mano
 * por cada marca y por cada esquema, que es justo lo que no escala.
 */

export type ColorScheme = "light" | "dark";

export type BrandBaseColors = {
  /** Color principal de la marca: botones, enfasis, elementos activos. */
  brand: string;
  /** Segundo color, para detalles. Si no se da, se usa el de marca. */
  accent?: string;
  /** Color de exito (disponibilidad, confirmaciones). */
  success?: string;
  /** Color de advertencia (capacidad media, avisos). */
  warning?: string;
  /** Color de error. */
  danger?: string;
  /** Tono del gris: por defecto se saca del color de marca para que "combine". */
  neutralHue?: number;
  /** Fondos y texto: si el socio los manda (WP oscuro, etc.), no se derivan. */
  background?: string;
  surface?: string;
  surfaceRaised?: string;
  text?: string;
  mutedText?: string;
  border?: string;
};

export type ResolvedPalette = {
  brand: string;
  brandContrast: string;
  accent: string;
  accentContrast: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  mutedText: string;
  border: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
};

type Hsl = { h: number; s: number; l: number };

/** Blancos, negros y grises: no tienen tono util que respetar. */
function isAchromatic({ s }: Hsl): boolean {
  return s < 12;
}

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;

  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  return { h, s: s * 100, l: l * 100 };
}

function hsl({ h, s, l }: Hsl): string {
  const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
  return `hsl(${Math.round(h)} ${clamp(s).toFixed(1)}% ${clamp(l).toFixed(1)}%)`;
}

/**
 * Blanco o negro segun el brillo percibido, para que el texto encima del color
 * de marca siempre se lea (un amarillo pide texto negro, un azul marino blanco).
 */
export function readableTextOn(hexOrHsl: string): string {
  const { l, s, h } = hexOrHsl.startsWith("#") ? hexToHsl(hexOrHsl) : parseHslString(hexOrHsl);
  // El verde y el amarillo se perciben mas claros que el azul con la misma luminosidad.
  const hueWeight = h > 40 && h < 200 ? 8 : 0;
  return l + hueWeight * (s / 100) > 62 ? "#0b0b0d" : "#ffffff";
}

function parseHslString(value: string): Hsl {
  const match = value.match(/hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
  if (!match) return { h: 0, s: 0, l: 50 };
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}

function applySurfaceOverrides(base: BrandBaseColors, palette: ResolvedPalette): ResolvedPalette {
  return {
    ...palette,
    background: base.background ?? palette.background,
    surface: base.surface ?? palette.surface,
    surfaceRaised: base.surfaceRaised ?? palette.surfaceRaised,
    text: base.text ?? palette.text,
    mutedText: base.mutedText ?? palette.mutedText,
    border: base.border ?? palette.border,
  };
}

export function buildPalette(base: BrandBaseColors, scheme: ColorScheme): ResolvedPalette {
  const brandHsl = hexToHsl(base.brand);
  const accentHsl = base.accent ? hexToHsl(base.accent) : brandHsl;
  const successHsl = hexToHsl(base.success ?? "#16a34a");
  const warningHsl = hexToHsl(base.warning ?? "#d97706");
  const dangerHsl = hexToHsl(base.danger ?? "#dc2626");

  // Los grises llevan una pizca del tono de la marca: es lo que hace que un tema
  // se sienta "de la marca" y no un gris de plantilla.
  const neutralHue = base.neutralHue ?? brandHsl.h;
  const neutralSat = isAchromatic(brandHsl) ? 0 : 12;

  if (scheme === "dark") {
    // En oscuro el color de marca se aclara: un color oscuro sobre fondo oscuro
    // no se ve, y es el error tipico al "hacer el dark mode a mano".
    //
    // Ojo con los colores sin color: un negro (#111) tiene tono 0, que es el
    // rojo. Subirle la saturacion a ciegas convierte una marca en blanco y negro
    // en una marca roja, asi que lo acromatico se queda acromatico.
    const brand = hsl({
      h: brandHsl.h,
      s: isAchromatic(brandHsl) ? brandHsl.s : Math.max(brandHsl.s, 45),
      l: isAchromatic(brandHsl) ? 92 : Math.max(brandHsl.l, 58),
    });
    const accent = hsl({
      h: accentHsl.h,
      s: isAchromatic(accentHsl) ? accentHsl.s : Math.max(accentHsl.s, 45),
      l: isAchromatic(accentHsl) ? 88 : Math.max(accentHsl.l, 62),
    });

    return applySurfaceOverrides(base, {
      brand,
      brandContrast: readableTextOn(brand),
      accent,
      accentContrast: readableTextOn(accent),
      background: hsl({ h: neutralHue, s: neutralSat, l: 7 }),
      surface: hsl({ h: neutralHue, s: neutralSat, l: 11 }),
      surfaceRaised: hsl({ h: neutralHue, s: neutralSat, l: 15 }),
      text: hsl({ h: neutralHue, s: neutralSat * 0.5, l: 96 }),
      mutedText: hsl({ h: neutralHue, s: neutralSat * 0.6, l: 66 }),
      border: hsl({ h: neutralHue, s: neutralSat, l: 22 }),
      success: hsl({ h: successHsl.h, s: 55, l: 60 }),
      successSoft: hsl({ h: successHsl.h, s: 40, l: 18 }),
      warning: hsl({ h: warningHsl.h, s: 70, l: 62 }),
      warningSoft: hsl({ h: warningHsl.h, s: 45, l: 18 }),
      danger: hsl({ h: dangerHsl.h, s: 70, l: 65 }),
      dangerSoft: hsl({ h: dangerHsl.h, s: 45, l: 20 }),
      overlay: "hsl(0 0% 0% / 0.72)",
    });
  }

  const brand = hsl({ h: brandHsl.h, s: brandHsl.s, l: Math.min(brandHsl.l, 52) });
  const accent = hsl(accentHsl);

  return applySurfaceOverrides(base, {
    brand,
    brandContrast: readableTextOn(brand),
    accent,
    accentContrast: readableTextOn(accent),
    background: hsl({ h: neutralHue, s: neutralSat, l: 97 }),
    surface: "#ffffff",
    surfaceRaised: hsl({ h: neutralHue, s: neutralSat, l: 99 }),
    text: hsl({ h: neutralHue, s: neutralSat, l: 11 }),
    mutedText: hsl({ h: neutralHue, s: neutralSat * 0.7, l: 44 }),
    border: hsl({ h: neutralHue, s: neutralSat, l: 89 }),
    success: hsl({ h: successHsl.h, s: successHsl.s, l: 34 }),
    successSoft: hsl({ h: successHsl.h, s: 60, l: 94 }),
    warning: hsl({ h: warningHsl.h, s: warningHsl.s, l: 38 }),
    warningSoft: hsl({ h: warningHsl.h, s: 80, l: 93 }),
    danger: hsl({ h: dangerHsl.h, s: dangerHsl.s, l: 46 }),
    dangerSoft: hsl({ h: dangerHsl.h, s: 75, l: 96 }),
    overlay: "hsl(0 0% 8% / 0.55)",
  });
}
