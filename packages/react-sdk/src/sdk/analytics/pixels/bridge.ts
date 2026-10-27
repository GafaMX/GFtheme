import type { TrackInput } from "../events";
import type { PixelBridge, PixelConsent, PixelEventName, PixelPayload, PixelsConfig } from "./types";
import { mapTrackerEvent, payloadHasPii, stripPii } from "./map";
import { createPageViewGate, shouldSendOnce } from "./eventId";
import { hashEmail, hashPhone } from "./hash";
import {
  getFbq,
  getGtag,
  getTtq,
  loadGoogleTags,
  loadMetaPixel,
  loadTikTokPixel,
  updateGoogleConsent,
} from "./loaders";

const META_NAMES: Record<PixelEventName, string> = {
  page_view: "PageView",
  view_content: "ViewContent",
  add_to_cart: "AddToCart",
  initiate_checkout: "InitiateCheckout",
  purchase: "Purchase",
  schedule: "Schedule",
  complete_registration: "CompleteRegistration",
};

const TIKTOK_NAMES: Record<PixelEventName, string> = {
  page_view: "page",
  view_content: "ViewContent",
  add_to_cart: "AddToCart",
  initiate_checkout: "InitiateCheckout",
  purchase: "CompletePayment",
  schedule: "Schedule",
  complete_registration: "CompleteRegistration",
};

const GA4_NAMES: Record<PixelEventName, string> = {
  page_view: "page_view",
  view_content: "view_item",
  add_to_cart: "add_to_cart",
  initiate_checkout: "begin_checkout",
  purchase: "purchase",
  schedule: "generate_lead",
  complete_registration: "sign_up",
};

function publicParams(payload: PixelPayload): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (payload.value != null) params.value = payload.value;
  if (payload.currency) params.currency = payload.currency;
  if (payload.content_ids) params.content_ids = payload.content_ids;
  if (payload.content_type) params.content_type = payload.content_type;
  if (payload.num_items != null) params.num_items = payload.num_items;
  if (payload.transaction_id) params.transaction_id = payload.transaction_id;
  return stripPii(params);
}

function fireMeta(name: PixelEventName, payload: PixelPayload): void {
  const fbq = getFbq();
  if (!fbq) return;
  const params = publicParams(payload);
  if (payloadHasPii(params)) return;
  if (name === "page_view") {
    fbq("track", "PageView", params, { eventID: payload.event_id });
    return;
  }
  fbq("track", META_NAMES[name], params, { eventID: payload.event_id });
}

function fireTikTok(name: PixelEventName, payload: PixelPayload): void {
  const ttq = getTtq();
  if (!ttq) return;
  const params = { ...publicParams(payload), event_id: payload.event_id };
  if (payloadHasPii(params)) return;
  if (name === "page_view") {
    ttq.page();
    return;
  }
  ttq.track(TIKTOK_NAMES[name], params);
}

function fireGoogle(name: PixelEventName, payload: PixelPayload, config: PixelsConfig): void {
  const gtag = getGtag();
  if (!gtag) return;
  const params = {
    ...publicParams(payload),
    transaction_id: payload.event_id,
  };
  if (payload.transaction_id) params.transaction_id = payload.event_id;
  if (payloadHasPii(params)) return;
  gtag("event", GA4_NAMES[name], params);
  if (name === "schedule") {
    gtag("event", "schedule", params);
  }
  if (name === "purchase" && config.googleAdsId && config.googleAdsPurchaseLabel) {
    gtag("event", "conversion", {
      ...params,
      send_to: `${config.googleAdsId}/${config.googleAdsPurchaseLabel}`,
    });
  }
}

async function applyAdvancedMatching(config: PixelsConfig, consent: PixelConsent): Promise<void> {
  if (!consent.marketing) return;
  const em = await hashEmail(consent.email).catch(() => undefined);
  const ph = await hashPhone(consent.phone).catch(() => undefined);
  if (!em && !ph) return;
  const hashed: Record<string, string> = {};
  if (em) hashed.em = em;
  if (ph) hashed.ph = ph;
  try {
    getFbq()?.("init", config.metaPixelId, hashed);
  } catch {
    // ignore
  }
  try {
    getTtq()?.identify?.(hashed);
  } catch {
    // ignore
  }
}

export function createPixelBridge(config: PixelsConfig): PixelBridge {
  let marketing = config.consentMode === "implied";
  let loaded = false;
  const queued: TrackInput[] = [];
  let consentEmail: string | null = null;
  let consentPhone: string | null = null;
  let destroyed = false;
  const pageViewGate = createPageViewGate();

  function canLoad(): boolean {
    return !destroyed && config.enabled && (config.consentMode === "implied" || marketing);
  }

  function loadProviders(): void {
    if (loaded || !canLoad()) return;
    try {
      if (config.metaPixelId) loadMetaPixel(config.metaPixelId);
      if (config.tiktokPixelId) loadTikTokPixel(config.tiktokPixelId);
      if (config.ga4MeasurementId || config.googleAdsId) {
        loadGoogleTags(config, marketing);
      }
      loaded = true;
      void applyAdvancedMatching(config, { marketing, email: consentEmail, phone: consentPhone });
    } catch {
      loaded = false;
    }
  }

  function emit(input: TrackInput): void {
    try {
      const mapped = mapTrackerEvent(input);
      if (!mapped) return;
      if (mapped.name === "page_view" && !pageViewGate.allow(input)) return;
      if (!shouldSendOnce(mapped.name, mapped.payload.event_id)) return;
      if (config.metaPixelId) fireMeta(mapped.name, mapped.payload);
      if (config.tiktokPixelId) fireTikTok(mapped.name, mapped.payload);
      if (config.ga4MeasurementId || config.googleAdsId) fireGoogle(mapped.name, mapped.payload, config);
    } catch {
      // un proveedor no tumba el SDK
    }
  }

  function flush(): void {
    if (!canLoad()) return;
    loadProviders();
    const pending = queued.splice(0, queued.length);
    pending.forEach(emit);
  }

  if (canLoad()) loadProviders();

  return {
    annotate(input) {
      const mapped = mapTrackerEvent(input);
      if (!mapped) return input;
      return {
        ...input,
        props: {
          ...(input.props ?? {}),
          event_id: mapped.payload.event_id,
          ...(mapped.payload.currency ? { currency: mapped.payload.currency } : {}),
        },
      };
    },
    handle(input) {
      if (destroyed || !config.enabled) return;
      if (!canLoad()) {
        queued.push(input);
        return;
      }
      loadProviders();
      emit(input);
    },
    setConsent(consent) {
      if (consent.email !== undefined) consentEmail = consent.email ?? null;
      if (consent.phone !== undefined) consentPhone = consent.phone ?? null;
      if (consent.marketing === true) {
        marketing = true;
        try {
          updateGoogleConsent(true);
        } catch {
          // ignore
        }
        flush();
        void applyAdvancedMatching(config, { marketing, email: consentEmail, phone: consentPhone });
      } else if (consent.marketing === false) {
        marketing = false;
        try {
          updateGoogleConsent(false);
        } catch {
          // ignore
        }
      }
    },
    getConsent() {
      return { marketing };
    },
    destroy() {
      destroyed = true;
      queued.length = 0;
      pageViewGate.reset();
    },
  };
}

export function noopPixelBridge(): PixelBridge {
  return {
    annotate: (input) => input,
    handle() {},
    setConsent() {},
    getConsent: () => ({ marketing: false }),
    destroy() {},
  };
}
