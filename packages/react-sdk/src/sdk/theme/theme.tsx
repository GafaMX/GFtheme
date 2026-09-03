import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildPalette, type BrandBaseColors, type ColorScheme } from "./palette";
import { readHostColorScheme, resolveActiveColorScheme, watchHostColorScheme, withHostSurfaceVars } from "./hostColorScheme";

export type ColorSchemePreference = ColorScheme | "system" | "host";

export type GafaThemeRadius = {
  sm: string;
  md: string;
  lg: string;
  pill: string;
};

export type GafaBrandTheme = {
  preset?: string;
  logoUrl?: string;
  /** Wordmark claro para dark. Si no viene, se usa `logoUrl` (Fitspin hoy). */
  logoUrlDark?: string;
  /** Los pocos colores que define el socio. El resto se deriva. */
  colors?: Partial<BrandBaseColors>;
  typography?: {
    fontFamily?: string;
    headingFontFamily?: string;
  };
  radius?: Partial<GafaThemeRadius>;
  assets?: {
    heroBackgroundUrl?: string;
    loginBackgroundUrl?: string;
  };
  /**
   * Esquema inicial si la página no declara uno.
   * Esquema si la página no declara uno. Fitspin (`html.fitspin-dark`,
   * `fitspin-theme` y `--sdk-*` del overlay) le gana: la muralla anti-Elementor
   * no deja que el CSS del sitio pinte `--gafa-color-*` directo.
   */
  colorScheme?: ColorSchemePreference;
  /** Si el usuario final puede cambiar entre claro y oscuro. */
  allowUserColorScheme?: boolean;
};

const defaultBase: BrandBaseColors = {
  brand: "#111827",
  accent: "#f97316",
  success: "#16a34a",
  danger: "#dc2626",
};

const defaultRadius: GafaThemeRadius = {
  sm: "10px",
  md: "16px",
  lg: "24px",
  pill: "999px",
};

const presets: Record<string, GafaBrandTheme> = {
  default: {},
  boutique: {
    colors: { brand: "#18181b", accent: "#ec4899" },
    radius: { md: "18px", lg: "28px" },
  },
  "fitness-dark": {
    colors: { brand: "#f97316", accent: "#22c55e" },
    colorScheme: "dark",
  },
  "wellness-light": {
    colors: { brand: "#0f766e", accent: "#14b8a6" },
    colorScheme: "light",
  },
};

const STORAGE_KEY = "gafa-sdk-color-scheme";

/**
 * Por defecto los widgets HEREDAN la tipografia del sitio donde se montan: el
 * SDK no impone ni descarga fuentes (un @import de Google Fonts obligaria a
 * todos los socios a cargar una fuente que no es la suya).
 *
 * Un socio que quiera algo distinto lo pasa en `theme.typography`, p.ej.
 * `fontFamily: NEUTRAL_FONT_STACK` para una pila del sistema.
 */
const DEFAULT_FONT_STACK = "inherit";

/** Pila neutra del sistema: Roboto en Android, San Francisco en Apple, Segoe en Windows. */
export const NEUTRAL_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function resolveTheme(theme?: GafaBrandTheme) {
  const preset = presets[theme?.preset ?? "default"] ?? presets.default;

  return {
    preset: theme?.preset ?? "default",
    logoUrl: theme?.logoUrl ?? preset.logoUrl ?? "",
    logoUrlDark: theme?.logoUrlDark ?? preset.logoUrlDark ?? "",
    colors: { ...defaultBase, ...preset.colors, ...theme?.colors } as BrandBaseColors,
    typography: {
      // Por defecto se hereda la tipografia del sitio del socio: el SDK no
      // impone (ni descarga) una fuente propia. El fallback es la del sistema
      // (Roboto en Android, San Francisco en Apple, Segoe en Windows) para el
      // caso raro de una pagina que no define ninguna.
      fontFamily:
        theme?.typography?.fontFamily ?? preset.typography?.fontFamily ?? DEFAULT_FONT_STACK,
      headingFontFamily:
        theme?.typography?.headingFontFamily ??
        preset.typography?.headingFontFamily ??
        theme?.typography?.fontFamily ??
        preset.typography?.fontFamily ??
        DEFAULT_FONT_STACK,
    },
    radius: { ...defaultRadius, ...preset.radius, ...theme?.radius },
    assets: { ...preset.assets, ...theme?.assets },
    colorScheme: theme?.colorScheme ?? preset.colorScheme ?? "light",
    allowUserColorScheme: theme?.allowUserColorScheme ?? preset.allowUserColorScheme ?? true,
  };
}

export function themeToCssVariables(theme: GafaBrandTheme | undefined, scheme: ColorScheme): Record<string, string> {
  const resolved = resolveTheme(theme);
  const palette = buildPalette(resolved.colors, scheme);

  return withHostSurfaceVars({
    "--gafa-color-primary": palette.brand,
    "--gafa-color-primary-text": palette.brandContrast,
    "--gafa-color-accent": palette.accent,
    "--gafa-color-accent-text": palette.accentContrast,
    "--gafa-color-background": palette.background,
    "--gafa-color-surface": palette.surface,
    "--gafa-color-surface-raised": palette.surfaceRaised,
    "--gafa-color-text": palette.text,
    "--gafa-color-muted-text": palette.mutedText,
    "--gafa-color-border": palette.border,
    "--gafa-color-success": palette.success,
    "--gafa-color-success-soft": palette.successSoft,
    "--gafa-color-warning": palette.warning,
    "--gafa-color-warning-soft": palette.warningSoft,
    "--gafa-color-danger": palette.danger,
    "--gafa-color-danger-soft": palette.dangerSoft,
    "--gafa-color-overlay": palette.overlay,
    // Superficie de modales: NO sigue `--sdk-background-color` del host.
    // En Voltio/Fitspin dark ese token llega transparente o con alpha y el
    // fancy deja ver el calendario. El carrito ya usa surface-raised (opaco).
    "--gafa-color-modal": palette.surface,
    "--gafa-font-body": resolved.typography.fontFamily,
    "--gafa-font-heading": resolved.typography.headingFontFamily,
    "--gafa-radius-sm": resolved.radius.sm,
    "--gafa-radius-md": resolved.radius.md,
    "--gafa-radius-lg": resolved.radius.lg,
    "--gafa-radius-pill": resolved.radius.pill,
    "--gafa-asset-hero-background": resolved.assets.heroBackgroundUrl
      ? `url("${resolved.assets.heroBackgroundUrl}")`
      : "none",
    "--gafa-asset-login-background": resolved.assets.loginBackgroundUrl
      ? `url("${resolved.assets.loginBackgroundUrl}")`
      : "none",
  });
}

type ThemeContextValue = {
  scheme: ColorScheme;
  preference: ColorSchemePreference;
  setPreference(preference: ColorSchemePreference): void;
  allowUserColorScheme: boolean;
  logoUrl: string;
  logoUrlDark: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useGafaTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useGafaTheme debe usarse dentro de un ThemeProvider.");
  }
  return context;
}

/** Tests y overlays sueltos: si no hay provider, no hay logo ni scheme. */
export function useGafaThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}

function systemScheme(): ColorScheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredPreference(): ColorSchemePreference | null {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" || value === "system" || value === "host" ? value : null;
}

function useHostColorScheme(): ColorScheme | null {
  const [scheme, setScheme] = useState<ColorScheme | null>(() =>
    typeof document === "undefined" ? null : readHostColorScheme(document),
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setScheme(readHostColorScheme(document));
    sync();
    return watchHostColorScheme(sync);
  }, []);

  return scheme;
}

export function ThemeProvider({ children, theme }: { children: React.ReactNode; theme?: GafaBrandTheme }) {
  const resolved = useMemo(() => resolveTheme(theme), [theme]);

  // La eleccion del usuario gana sobre el default del socio, pero solo si el socio
  // dejo activada la opcion.
  const [preference, setPreferenceState] = useState<ColorSchemePreference>(
    () => (resolved.allowUserColorScheme ? readStoredPreference() : null) ?? resolved.colorScheme,
  );
  const [osScheme, setOsScheme] = useState<ColorScheme>(systemScheme);
  const hostScheme = useHostColorScheme();

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => setOsScheme(query.matches ? "dark" : "light");
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  const setPreference = useCallback((next: ColorSchemePreference) => {
    setPreferenceState(next);
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const scheme: ColorScheme = resolveActiveColorScheme({
    hostScheme,
    preference,
    osScheme,
  });
  const variables = useMemo(() => themeToCssVariables(theme, scheme), [theme, scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      preference,
      setPreference,
      allowUserColorScheme: resolved.allowUserColorScheme,
      logoUrl: resolved.logoUrl,
      logoUrlDark: resolved.logoUrlDark,
    }),
    [
      preference,
      resolved.allowUserColorScheme,
      resolved.logoUrl,
      resolved.logoUrlDark,
      scheme,
      setPreference,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="gafa-sdk" data-color-scheme={scheme} style={variables as React.CSSProperties}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function ColorSchemeToggle({ className }: { className?: string }) {
  const { scheme, setPreference, allowUserColorScheme } = useGafaTheme();

  if (!allowUserColorScheme) return null;

  return (
    <button
      type="button"
      className={className ?? "gafa-scheme-toggle"}
      onClick={() => setPreference(scheme === "dark" ? "light" : "dark")}
      aria-label={scheme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={scheme === "dark" ? "Tema claro" : "Tema oscuro"}
    >
      {scheme === "dark" ? "☀" : "☾"}
    </button>
  );
}

export type { BrandBaseColors, ColorScheme };
