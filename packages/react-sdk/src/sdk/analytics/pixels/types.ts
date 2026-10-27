import type { TrackInput } from "../events";

export const PIXEL_EVENT_NAMES = [
  "page_view",
  "view_content",
  "add_to_cart",
  "initiate_checkout",
  "purchase",
  "schedule",
  "complete_registration",
] as const;

export type PixelEventName = (typeof PIXEL_EVENT_NAMES)[number];

export type PixelConsentMode = "required" | "implied";

export type PixelProviderId = "meta" | "tiktok" | "google";

export type PixelsConfig = {
  enabled: boolean;
  consentMode: PixelConsentMode;
  metaPixelId?: string;
  tiktokPixelId?: string;
  ga4MeasurementId?: string;
  googleAdsId?: string;
  googleAdsPurchaseLabel?: string;
};

export type PixelCommerce = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: "product" | "class";
  num_items?: number;
  transaction_id?: string;
};

export type PixelPayload = PixelCommerce & {
  event_id: string;
};

export type MappedPixelEvent = {
  name: PixelEventName;
  payload: PixelPayload;
  source: TrackInput;
};

/**
 * Contrato para un futuro CAPI server-side. Este PR no lo implementa:
 * el cliente solo deja el mismo `event_id` en `props` del Hub.
 */
export type CapiEventHook = {
  event_id: string;
  event_name: PixelEventName;
  event_time: number;
  custom_data: PixelCommerce;
  user_data?: {
    em?: string;
    ph?: string;
  };
};

export type PixelConsent = {
  marketing?: boolean;
  email?: string | null;
  phone?: string | null;
};

export type PixelBridge = {
  annotate(input: TrackInput): TrackInput;
  handle(input: TrackInput): void;
  setConsent(consent: PixelConsent): void;
  getConsent(): { marketing: boolean };
  destroy(): void;
};
