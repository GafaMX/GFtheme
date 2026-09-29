import { ConciergePartnerConfig as ConciergePartnerConfigSchema, type ConciergePartnerConfig } from "./contracts";
import { createLiveConciergeConfig, type LiveConciergeConfigInput } from "./liveConfig";
import { deepMerge, isPlainObject } from "../config/merge";

export const GENERATED_CONCIERGE_DISPLAY_NAME = "tu estudio";

export type ConciergeResolveContext = {
  companyId: number;
  theme?: {
    colorScheme?: unknown;
    colors?: Record<string, unknown> | null;
  } | null;
};

function asHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : fallback;
}

function conciergeIdForCompany(companyId: number): string {
  return `company-${companyId}`;
}

export function isGeneratedConciergeId(id: string): boolean {
  return /^company-\d+$/.test(id);
}

function readPartial(input: unknown): Record<string, unknown> {
  return isPlainObject(input) ? input : {};
}

export function liveConciergeInputFromContext(
  context: ConciergeResolveContext,
  partial: unknown = {},
): LiveConciergeConfigInput {
  const overlay = readPartial(partial);
  const theme = context.theme && typeof context.theme === "object" ? context.theme : {};
  const colors = theme.colors && typeof theme.colors === "object" ? theme.colors : {};
  const mode = theme.colorScheme === "dark" ? "dark" : "light";
  const contact = isPlainObject(overlay.contact) ? overlay.contact : {};
  const overlayTheme = isPlainObject(overlay.theme) ? overlay.theme : {};
  const id = typeof overlay.id === "string" && overlay.id.trim() ? overlay.id.trim() : conciergeIdForCompany(context.companyId);
  const displayName =
    typeof overlay.displayName === "string" && overlay.displayName.trim()
      ? overlay.displayName.trim()
      : GENERATED_CONCIERGE_DISPLAY_NAME;
  const whatsapp = typeof contact.whatsapp === "string" ? contact.whatsapp : undefined;

  return {
    id,
    displayName,
    companyId: context.companyId,
    locale: typeof overlay.locale === "string" ? overlay.locale : undefined,
    timezone: typeof overlay.timezone === "string" ? overlay.timezone : undefined,
    theme: {
      mode: overlayTheme.mode === "dark" || overlayTheme.mode === "light" ? overlayTheme.mode : mode,
      accent: asHexColor(overlayTheme.accent, asHexColor(colors.brand, asHexColor(colors.accent, "#f97316"))),
      foreground: asHexColor(overlayTheme.foreground, asHexColor(colors.text, "#111111")),
    },
    whatsapp: whatsapp && whatsapp.trim() ? whatsapp.trim() : undefined,
  };
}

export function isConciergeShorthand(input: unknown): boolean {
  return input === true || (isPlainObject(input) && Object.keys(input).length === 0);
}

/**
 * `true` / `{}` / partial / objeto completo.
 * Completo (pasa Zod) se respeta. El resto se arma con `createLiveConciergeConfig` + merge.
 */
export function resolveConciergeFromInput(
  input: unknown,
  context: ConciergeResolveContext,
): ConciergePartnerConfig {
  if (input === false || input == null) {
    throw new Error(
      "Concierge config was not found. Expected CONCIERGE in [data-gf-options], a [data-gafa-concierge-config] script, or data-gafa-concierge-fixture.",
    );
  }
  if (!Number.isFinite(context.companyId) || context.companyId <= 0) {
    throw new Error("Concierge needs COMPANY_ID to build the live default.");
  }

  if (isConciergeShorthand(input)) {
    return createLiveConciergeConfig(liveConciergeInputFromContext(context));
  }

  if (isPlainObject(input)) {
    const complete = ConciergePartnerConfigSchema.safeParse(input);
    if (complete.success) return complete.data;
    const defaults = createLiveConciergeConfig(liveConciergeInputFromContext(context, input));
    return ConciergePartnerConfigSchema.parse(deepMerge(defaults, input));
  }

  throw new Error("CONCIERGE must be true, {}, or an object.");
}

export function conciergeContextFromOptions(options: Record<string, unknown> | undefined): ConciergeResolveContext {
  const companyId = Number(options?.COMPANY_ID ?? options?.companyId);
  const theme = (options?.THEME ?? options?.theme) as ConciergeResolveContext["theme"];
  return { companyId, theme };
}
