import { coerceFlag } from "../../cart/membershipPayOptions";
import type { PixelConsentMode, PixelsConfig } from "./types";

const CAPI_SECRET_KEYS = [
  "META_CAPI_TOKEN",
  "metaCapiToken",
  "TIKTOK_ACCESS_TOKEN",
  "tiktokAccessToken",
  "GOOGLE_ADS_API_SECRET",
  "googleAdsApiSecret",
] as const;

export const PIXEL_REMOTE_CONFIG_KEYS = [
  "META_PIXEL_ID",
  "TIKTOK_PIXEL_ID",
  "GA4_MEASUREMENT_ID",
  "GOOGLE_ADS_ID",
  "GOOGLE_ADS_PURCHASE_LABEL",
  "PIXELS_ENABLED",
  "PIXELS_CONSENT_MODE",
  "metaPixelId",
  "tiktokPixelId",
  "ga4MeasurementId",
  "googleAdsId",
  "googleAdsPurchaseLabel",
  "pixelsEnabled",
  "pixelsConsentMode",
] as const;

export const PIXEL_SECRET_KEYS = CAPI_SECRET_KEYS;

function trimId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseConsentMode(value: unknown): PixelConsentMode {
  if (typeof value === "string" && value.trim().toLowerCase() === "implied") return "implied";
  return "required";
}

/** Lee IDs públicos. Tokens de CAPI nunca salen de aquí: ni se leen. */
export function readPixelsConfig(input: Record<string, unknown> | null | undefined): PixelsConfig {
  const raw = input ?? {};
  return {
    enabled: coerceFlag(raw.pixelsEnabled ?? raw.PIXELS_ENABLED) === true,
    consentMode: parseConsentMode(raw.pixelsConsentMode ?? raw.PIXELS_CONSENT_MODE),
    metaPixelId: trimId(raw.metaPixelId ?? raw.META_PIXEL_ID),
    tiktokPixelId: trimId(raw.tiktokPixelId ?? raw.TIKTOK_PIXEL_ID),
    ga4MeasurementId: trimId(raw.ga4MeasurementId ?? raw.GA4_MEASUREMENT_ID),
    googleAdsId: trimId(raw.googleAdsId ?? raw.GOOGLE_ADS_ID),
    googleAdsPurchaseLabel: trimId(raw.googleAdsPurchaseLabel ?? raw.GOOGLE_ADS_PURCHASE_LABEL),
  };
}

export function pixelsHaveAnyId(config: PixelsConfig): boolean {
  return Boolean(config.metaPixelId || config.tiktokPixelId || config.ga4MeasurementId || config.googleAdsId);
}
