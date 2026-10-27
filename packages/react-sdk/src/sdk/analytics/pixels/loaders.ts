import type { PixelsConfig } from "./types";

type PixelWindow = Window & {
  fbq?: FbqFn;
  _fbq?: FbqFn;
  ttq?: TtqFn;
  TiktokAnalyticsObject?: string;
  dataLayer?: unknown[];
  gtag?: GtagFn;
};

export type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

export type TtqFn = {
  track: (...args: unknown[]) => void;
  page: (...args: unknown[]) => void;
  identify?: (...args: unknown[]) => void;
  load?: (...args: unknown[]) => void;
  instances?: unknown;
};

export type GtagFn = (...args: unknown[]) => void;

const META_SRC = "https://connect.facebook.net/en_US/fbevents.js";
const TIKTOK_SRC = "https://analytics.tiktok.com/i18n/pixel/events.js";
const GTAG_SRC = (id: string) => `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;

function win(): PixelWindow | null {
  return typeof window === "undefined" ? null : (window as PixelWindow);
}

function injectScript(src: string, datasetKey: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[data-buq-pixel="${datasetKey}"]`)) return;
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  script.dataset.buqPixel = datasetKey;
  script.onerror = () => undefined;
  document.head.appendChild(script);
}

function ensureFbqStub(): FbqFn | null {
  const w = win();
  if (!w) return null;
  if (typeof w.fbq === "function") return w.fbq;
  const fbq: FbqFn = (...args: unknown[]) => {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      (fbq.queue ?? (fbq.queue = [])).push(args);
    }
  };
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  w.fbq = fbq;
  w._fbq = fbq;
  return fbq;
}

function ensureTtqStub(): TtqFn | null {
  const w = win();
  if (!w) return null;
  if (w.ttq && typeof w.ttq.track === "function") return w.ttq;
  const ttq = {
    track(...args: unknown[]) {
      (this._q = this._q ?? []).push(["track", ...args]);
    },
    page(...args: unknown[]) {
      (this._q = this._q ?? []).push(["page", ...args]);
    },
    identify(...args: unknown[]) {
      (this._q = this._q ?? []).push(["identify", ...args]);
    },
    load(...args: unknown[]) {
      (this._q = this._q ?? []).push(["load", ...args]);
    },
    _q: [] as unknown[],
  } as TtqFn & { _q: unknown[] };
  w.ttq = ttq;
  w.TiktokAnalyticsObject = "ttq";
  return ttq;
}

function ensureGtagStub(): GtagFn | null {
  const w = win();
  if (!w) return null;
  w.dataLayer = w.dataLayer ?? [];
  if (typeof w.gtag === "function") return w.gtag;
  const gtag: GtagFn = function gtag(...args: unknown[]) {
    w.dataLayer!.push(args);
  };
  w.gtag = gtag;
  return gtag;
}

export function hostHasProvider(provider: "meta" | "tiktok" | "google"): boolean {
  const w = win();
  if (!w) return false;
  if (provider === "meta") return typeof w.fbq === "function";
  if (provider === "tiktok") return Boolean(w.ttq && typeof w.ttq.track === "function");
  return typeof w.gtag === "function";
}

export function loadMetaPixel(pixelId: string): FbqFn | null {
  try {
    const existed = hostHasProvider("meta");
    const fbq = ensureFbqStub();
    if (!fbq) return null;
    if (!existed) injectScript(META_SRC, "meta");
    fbq("init", pixelId);
    return fbq;
  } catch {
    return null;
  }
}

export function loadTikTokPixel(pixelId: string): TtqFn | null {
  try {
    const existed = hostHasProvider("tiktok");
    const ttq = ensureTtqStub();
    if (!ttq) return null;
    if (!existed) {
      injectScript(`${TIKTOK_SRC}?sdkid=${encodeURIComponent(pixelId)}&lib=ttq`, "tiktok");
    }
    ttq.load?.(pixelId);
    return ttq;
  } catch {
    return null;
  }
}

export function defaultGoogleConsentDenied(gtag: GtagFn): void {
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
}

export function updateGoogleConsent(granted: boolean): void {
  try {
    const gtag = ensureGtagStub();
    if (!gtag) return;
    const state = granted ? "granted" : "denied";
    gtag("consent", "update", {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    });
  } catch {
    // ignore
  }
}

export function loadGoogleTags(config: PixelsConfig, consentGranted: boolean): GtagFn | null {
  try {
    const existed = hostHasProvider("google");
    const gtag = ensureGtagStub();
    if (!gtag) return null;
    if (!existed) {
      defaultGoogleConsentDenied(gtag);
      gtag("js", new Date());
    }
    if (consentGranted) {
      updateGoogleConsent(true);
    } else {
      defaultGoogleConsentDenied(gtag);
    }
    const primary = config.ga4MeasurementId ?? config.googleAdsId;
    if (primary && !existed) injectScript(GTAG_SRC(primary), "google");
    if (config.ga4MeasurementId) gtag("config", config.ga4MeasurementId);
    if (config.googleAdsId) gtag("config", config.googleAdsId);
    return gtag;
  } catch {
    return null;
  }
}

export function getFbq(): FbqFn | null {
  const w = win();
  return w && typeof w.fbq === "function" ? w.fbq : null;
}

export function getTtq(): TtqFn | null {
  const w = win();
  return w?.ttq && typeof w.ttq.track === "function" ? w.ttq : null;
}

export function getGtag(): GtagFn | null {
  const w = win();
  return w && typeof w.gtag === "function" ? w.gtag : null;
}

export function scriptsInjected(): string[] {
  if (typeof document === "undefined") return [];
  return [...document.querySelectorAll("script[data-buq-pixel]")].map(
    (node) => (node as HTMLElement).dataset.buqPixel ?? "",
  );
}
