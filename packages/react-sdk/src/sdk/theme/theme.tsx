import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildPalette, definedColor, type BrandBaseColors, type ColorScheme } from "./palette";
import { readHostColorScheme, resolveSdkColorScheme, watchHostColorScheme, withHostSurfaceVars } from "./hostColorScheme";

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
  /** Tope del wordmark. Default 180×64; ATLIC puede mandar 220×110. */
  logoMaxWidth?: number | string;
  logoMaxHeight?: number | string;
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

export const DEFAULT_LOGO_MAX_WIDTH_PX = 180;
export const DEFAULT_LOGO_MAX_HEIGHT_PX = 64;

/** Preferencia del usuario, namespaced por compañía/cliente. Nunca una key global. */
export function themePreferenceStorageKey(scope?: string): string {
  const safe = String(scope ?? "anon")
    .trim()
    .replace(/[^\w.:-]+/g, "-") || "anon";
  return `gafa-sdk:color-scheme:${safe}`;
}

export function cssLength(value: number | string | undefined, fallbackPx: number): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return `${fallbackPx}px`;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
  return trimmed;
}

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

function resolveBrandColors(theme?: GafaBrandTheme, presetColors?: Partial<BrandBaseColors>): BrandBaseColors {
  const incoming = { ...presetColors, ...theme?.colors } as Partial<BrandBaseColors> & {
    primary?: string;
  };
  const brand = definedColor(incoming.brand) ?? definedColor(incoming.primary) ?? defaultBase.brand;
  return { ...defaultBase, ...incoming, brand };
}

export function resolveTheme(theme?: GafaBrandTheme) {
  const preset = presets[theme?.preset ?? "default"] ?? presets.default;

  return {
    preset: theme?.preset ?? "default",
    logoUrl: theme?.logoUrl ?? preset.logoUrl ?? "",
    logoUrlDark: theme?.logoUrlDark ?? preset.logoUrlDark ?? "",
    logoMaxWidth: theme?.logoMaxWidth ?? preset.logoMaxWidth,
    logoMaxHeight: theme?.logoMaxHeight ?? preset.logoMaxHeight,
    colors: resolveBrandColors(theme, preset.colors),
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

/** Tokens semánticos que `THEME.colors` pinta. `--gafa-color-brand` es alias de primary. */
export const THEME_COLOR_CSS_VARS = [
  "--gafa-color-brand",
  "--gafa-color-primary",
  "--gafa-color-accent",
  "--gafa-color-background",
  "--gafa-color-surface",
  "--gafa-color-surface-raised",
  "--gafa-color-text",
  "--gafa-color-muted-text",
  "--gafa-color-border",
  "--gafa-color-input-background",
  "--gafa-color-input-text",
  "--gafa-color-input-border",
  "--gafa-color-success",
  "--gafa-color-warning",
  "--gafa-color-danger",
] as const;

export function themeToCssVariables(
  theme: GafaBrandTheme | undefined,
  scheme: ColorScheme,
  options?: { followHostSurface?: boolean },
): Record<string, string> {
  const resolved = resolveTheme(theme);
  const palette = buildPalette(resolved.colors, scheme);

  const variables = {
    "--gafa-color-primary": palette.brand,
    "--gafa-color-primary-text": palette.brandContrast,
    /** Alias estable para socios: `colors.brand` → primary. No renombrar primary. */
    "--gafa-color-brand": palette.brand,
    "--gafa-color-brand-text": palette.brandContrast,
    "--gafa-color-accent": palette.accent,
    "--gafa-color-accent-text": palette.accentContrast,
    "--gafa-color-background": palette.background,
    "--gafa-color-surface": palette.surface,
    "--gafa-color-surface-raised": palette.surfaceRaised,
    "--gafa-color-text": palette.text,
    "--gafa-color-muted-text": palette.mutedText,
    "--gafa-color-border": palette.border,
    "--gafa-color-input-background": palette.inputBackground,
    "--gafa-color-input-text": palette.inputText,
    "--gafa-color-input-border": palette.inputBorder,
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
    "--gafa-logo-max-width": cssLength(resolved.logoMaxWidth, DEFAULT_LOGO_MAX_WIDTH_PX),
    "--gafa-logo-max-height": cssLength(resolved.logoMaxHeight, DEFAULT_LOGO_MAX_HEIGHT_PX),
  };
  if (options?.followHostSurface === false) return variables;
  return withHostSurfaceVars(variables);
}

type ThemeContextValue = {
  scheme: ColorScheme;
  preference: ColorSchemePreference;
  setPreference(preference: ColorSchemePreference): void;
  allowUserColorScheme: boolean;
  logoUrl: string;
  logoUrlDark: string;
  /** Mapa listo para el portal: no heredar del widget (el overlay va a body). */
  variables: Record<string, string>;
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

function readStoredPreference(scope?: string): ColorSchemePreference | null {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(themePreferenceStorageKey(scope));
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

export function ThemeProvider({
  children,
  theme,
  storageScope,
}: {
  children: React.ReactNode;
  theme?: GafaBrandTheme;
  /** `companyId:apiClient` para no contaminar marcas en el mismo dominio. */
  storageScope?: string;
}) {
  const resolved = useMemo(() => resolveTheme(theme), [theme]);
  const locked =
    resolved.allowUserColorScheme === false &&
    (resolved.colorScheme === "light" || resolved.colorScheme === "dark");

  const [preference, setPreferenceState] = useState<ColorSchemePreference>(
    () => (resolved.allowUserColorScheme ? readStoredPreference(storageScope) : null) ?? resolved.colorScheme,
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

  const setPreference = useCallback(
    (next: ColorSchemePreference) => {
      setPreferenceState(next);
      if (!resolved.allowUserColorScheme || typeof localStorage === "undefined") return;
      localStorage.setItem(themePreferenceStorageKey(storageScope), next);
    },
    [resolved.allowUserColorScheme, storageScope],
  );

  const scheme: ColorScheme = resolveSdkColorScheme({
    colorScheme: resolved.colorScheme,
    allowUserColorScheme: resolved.allowUserColorScheme,
    storedPreference: resolved.allowUserColorScheme ? preference : null,
    hostScheme: locked ? null : hostScheme,
    osScheme,
  });
  const variables = useMemo(
    () => themeToCssVariables(theme, scheme, { followHostSurface: !locked }),
    [locked, scheme, theme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      preference,
      setPreference,
      allowUserColorScheme: resolved.allowUserColorScheme,
      logoUrl: resolved.logoUrl,
      logoUrlDark: resolved.logoUrlDark,
      variables,
    }),
    [
      preference,
      resolved.allowUserColorScheme,
      resolved.logoUrl,
      resolved.logoUrlDark,
      scheme,
      setPreference,
      variables,
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
