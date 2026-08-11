import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildPalette, type BrandBaseColors, type ColorScheme } from "./palette";

export type ColorSchemePreference = ColorScheme | "system";

export type GafaThemeRadius = {
  sm: string;
  md: string;
  lg: string;
  pill: string;
};

export type GafaBrandTheme = {
  preset?: string;
  logoUrl?: string;
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
  /** Esquema inicial. `system` sigue la preferencia del sistema operativo. */
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

export function resolveTheme(theme?: GafaBrandTheme) {
  const preset = presets[theme?.preset ?? "default"] ?? presets.default;

  return {
    preset: theme?.preset ?? "default",
    logoUrl: theme?.logoUrl ?? preset.logoUrl ?? "",
    colors: { ...defaultBase, ...preset.colors, ...theme?.colors } as BrandBaseColors,
    typography: {
      fontFamily:
        theme?.typography?.fontFamily ??
        preset.typography?.fontFamily ??
        "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      headingFontFamily:
        theme?.typography?.headingFontFamily ??
        preset.typography?.headingFontFamily ??
        theme?.typography?.fontFamily ??
        preset.typography?.fontFamily ??
        "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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

  return {
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
  };
}

type ThemeContextValue = {
  scheme: ColorScheme;
  preference: ColorSchemePreference;
  setPreference(preference: ColorSchemePreference): void;
  allowUserColorScheme: boolean;
  logoUrl: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useGafaTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useGafaTheme debe usarse dentro de un ThemeProvider.");
  }
  return context;
}

function systemScheme(): ColorScheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredPreference(): ColorSchemePreference | null {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : null;
}

export function ThemeProvider({ children, theme }: { children: React.ReactNode; theme?: GafaBrandTheme }) {
  const resolved = useMemo(() => resolveTheme(theme), [theme]);

  // La eleccion del usuario gana sobre el default del socio, pero solo si el socio
  // dejo activada la opcion.
  const [preference, setPreferenceState] = useState<ColorSchemePreference>(
    () => (resolved.allowUserColorScheme ? readStoredPreference() : null) ?? resolved.colorScheme,
  );
  const [osScheme, setOsScheme] = useState<ColorScheme>(systemScheme);

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

  const scheme: ColorScheme = preference === "system" ? osScheme : preference;
  const variables = useMemo(() => themeToCssVariables(theme, scheme), [theme, scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      preference,
      setPreference,
      allowUserColorScheme: resolved.allowUserColorScheme,
      logoUrl: resolved.logoUrl,
    }),
    [preference, resolved.allowUserColorScheme, resolved.logoUrl, scheme, setPreference],
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
