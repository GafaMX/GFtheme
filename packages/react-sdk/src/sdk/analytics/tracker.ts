import { SDK_VERSION } from "../version";
import type { SdkAnalyticsEvent, TrackInput } from "./events";

export type TrackerConfig = {
  hubUrl: string;
  companyId: number;
  brandId?: number;
  sdkVersion?: string;
  enabled?: boolean;
};

export type SdkTracker = {
  sessionId: string;
  track(input: TrackInput): void;
  heartbeat(widgets: string[]): void;
  flush(): void;
};

const SESSION_KEY = "gafa-sdk:hub-session";

function readSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = createId();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return createId();
  }
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function normalizeHubUrl(hubUrl: string): string {
  return hubUrl.replace(/\/+$/, "");
}

export function createSdkTracker(config: TrackerConfig): SdkTracker {
  const enabled = config.enabled !== false && Boolean(config.hubUrl) && Number.isFinite(config.companyId);
  const sessionId = readSessionId();
  const queue: SdkAnalyticsEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const sdkVersion = config.sdkVersion ?? SDK_VERSION;

  function enqueue(input: TrackInput) {
    if (!enabled) return;
    const page =
      typeof window !== "undefined"
        ? { host: window.location.hostname, path: window.location.pathname }
        : { host: null, path: null };
    queue.push({
      event: input.event,
      ts: new Date().toISOString(),
      session_id: sessionId,
      company_id: config.companyId,
      brand_id: input.brand_id ?? config.brandId ?? null,
      location_id: input.location_id ?? null,
      user_id: input.user_id ?? null,
      widget: input.widget ?? null,
      sdk_version: sdkVersion,
      host: page.host,
      path: page.path,
      props: input.props,
    });
    if (queue.length >= 8) {
      flush();
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, 400);
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!enabled || queue.length === 0) return;
    const events = queue.splice(0, queue.length);
    const url = `${normalizeHubUrl(config.hubUrl)}/v1/events`;
    const payload = JSON.stringify({ events });
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([payload], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch {
      // El Hub no puede romper una reserva.
    }
    if (typeof fetch === "function") {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        mode: "cors",
      }).catch(() => undefined);
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => flush());
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return {
    sessionId,
    track: enqueue,
    heartbeat(widgets) {
      enqueue({
        event: "sdk.heartbeat",
        widget: widgets[0] ?? null,
        props: { widgets },
      });
      flush();
    },
    flush,
  };
}

export const noopTracker: SdkTracker = {
  sessionId: "noop",
  track() {},
  heartbeat() {},
  flush() {},
};
