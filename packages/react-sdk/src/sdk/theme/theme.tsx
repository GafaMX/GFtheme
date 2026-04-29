export type GafaThemeColors = {
  primary: string;
  primaryText: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  success: string;
  danger: string;
};

type ResolvedGafaTheme = {
  preset: string;
  logoUrl: string;
  colors: GafaThemeColors;
  typography: {
    fontFamily: string;
    headingFontFamily: string;
  };
  radius: GafaThemeRadius;
  assets: {
    heroBackgroundUrl?: string;
    loginBackgroundUrl?: string;
  };
};

export type GafaThemeRadius = {
  sm: string;
  md: string;
  lg: string;
  pill: string;
};

export type GafaBrandTheme = {
  preset?: string;
  logoUrl?: string;
  colors?: Partial<GafaThemeColors>;
  typography?: {
    fontFamily?: string;
    headingFontFamily?: string;
  };
  radius?: Partial<GafaThemeRadius>;
  assets?: {
    heroBackgroundUrl?: string;
    loginBackgroundUrl?: string;
  };
};

const defaultColors: GafaThemeColors = {
  primary: "#111827",
  primaryText: "#ffffff",
  accent: "#f97316",
  background: "#f8fafc",
  surface: "#ffffff",
  text: "#0f172a",
  mutedText: "#64748b",
  border: "#e2e8f0",
  success: "#16a34a",
  danger: "#dc2626",
};

const defaultRadius: GafaThemeRadius = {
  sm: "8px",
  md: "14px",
  lg: "22px",
  pill: "999px",
};

const presets: Record<string, GafaBrandTheme> = {
  default: {},
  boutique: {
    colors: {
      primary: "#18181b",
      accent: "#ec4899",
      background: "#fff7fb",
      surface: "#ffffff",
    },
    radius: {
      md: "18px",
      lg: "28px",
    },
  },
  "fitness-dark": {
    colors: {
      primary: "#f97316",
      primaryText: "#111827",
      accent: "#22c55e",
      background: "#09090b",
      surface: "#18181b",
      text: "#fafafa",
      mutedText: "#a1a1aa",
      border: "#27272a",
    },
  },
  "wellness-light": {
    colors: {
      primary: "#0f766e",
      accent: "#14b8a6",
      background: "#f0fdfa",
      surface: "#ffffff",
    },
  },
};

export function resolveTheme(theme?: GafaBrandTheme): ResolvedGafaTheme {
  const preset = presets[theme?.preset ?? "default"] ?? presets.default;

  return {
    preset: theme?.preset ?? "default",
    logoUrl: theme?.logoUrl ?? preset.logoUrl ?? "",
    colors: {
      ...defaultColors,
      ...preset.colors,
      ...theme?.colors,
    },
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
    radius: {
      ...defaultRadius,
      ...preset.radius,
      ...theme?.radius,
    },
    assets: {
      ...preset.assets,
      ...theme?.assets,
    },
  };
}

export function themeToCssVariables(theme?: GafaBrandTheme): Record<string, string> {
  const resolved = resolveTheme(theme);

  return {
    "--gafa-color-primary": resolved.colors.primary,
    "--gafa-color-primary-text": resolved.colors.primaryText,
    "--gafa-color-accent": resolved.colors.accent,
    "--gafa-color-background": resolved.colors.background,
    "--gafa-color-surface": resolved.colors.surface,
    "--gafa-color-text": resolved.colors.text,
    "--gafa-color-muted-text": resolved.colors.mutedText,
    "--gafa-color-border": resolved.colors.border,
    "--gafa-color-success": resolved.colors.success,
    "--gafa-color-danger": resolved.colors.danger,
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

export function ThemeProvider({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme?: GafaBrandTheme;
}) {
  return (
    <div className="gafa-sdk" style={themeToCssVariables(theme) as React.CSSProperties}>
      {children}
    </div>
  );
}
