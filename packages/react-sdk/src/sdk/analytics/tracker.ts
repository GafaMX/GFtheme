import { SDK_VERSION } from "../version";
import type { SdkAnalyticsEvent, TrackInput } from "./events";

export type TrackerConfig = {
  hubUrl: string;
  companyId: number;
  brandId?: number;
  sdkVersion?: string;
  enabled?: boolean;
};

export type HubUser = {
  id: number | null;
  name?: string | null;
  email?: string | null;
};

export type SdkTracker = {
  sessionId: string;
  track(input: TrackInput): void;
  heartbeat(widgets: string[]): void;
  getUser(): HubUser;
  setUserId(userId: number | null): void;
  setUser(user: HubUser): void;
  flush(): void;
};

const SESSION_KEY = "gafa-sdk:hub-session";
const USER_KEY = "gafa-sdk:hub-user";
const USER_PROFILE_KEY = "gafa-sdk:hub-profile";

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
  let userId = readStoredUserId();
  let userName = readStoredProfile().name;
  let userEmail = readStoredProfile().email;

  function enqueue(input: TrackInput) {
    if (!enabled) return;
    const page =
      typeof window !== "undefined"
        ? { host: window.location.hostname, path: window.location.pathname }
        : { host: null, path: null };
    const props = { ...(input.props ?? {}) };
    if (userName) props.user_name = userName;
    if (userEmail) props.user_email = userEmail;
    queue.push({
      event: input.event,
      ts: new Date().toISOString(),
      session_id: sessionId,
      company_id: config.companyId,
      brand_id: input.brand_id ?? config.brandId ?? null,
      location_id: input.location_id ?? null,
      user_id: input.user_id ?? userId,
      widget: input.widget ?? null,
      sdk_version: sdkVersion,
      host: page.host,
      path: page.path,
      props: Object.keys(props).length ? props : input.props,
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
    // sendBeacon usa credentials:include. No lo usamos: un Hub con ACAO *
    // lo bloquea, y si el beacon “hace queue” el fetch de respaldo no corre.
    if (typeof fetch === "function") {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      }).catch(() => undefined);
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => flush());
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  function applyUser(next: HubUser) {
    userId = next.id;
    if (next.name !== undefined) userName = next.name?.trim() || null;
    if (next.email !== undefined) userEmail = next.email?.trim() || null;
    try {
      if (next.id == null) {
        storageRemove(USER_KEY);
        storageRemove(USER_PROFILE_KEY);
        userName = null;
        userEmail = null;
      } else {
        storageSet(USER_KEY, String(next.id));
        storageSet(USER_PROFILE_KEY, JSON.stringify({ name: userName, email: userEmail }));
      }
    } catch {
      // ignore
    }
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
    getUser() {
      return { id: userId, name: userName, email: userEmail };
    },
    setUserId(next) {
      applyUser({ id: next });
    },
    setUser: applyUser,
    flush,
  };
}

export const noopTracker: SdkTracker = {
  sessionId: "noop",
  track() {},
  heartbeat() {},
  getUser() {
    return { id: null, name: null, email: null };
  },
  setUserId() {},
  setUser() {},
  flush() {},
};

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    return;
  } catch {
    // fallback
  }
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function readStoredUserId(): number | null {
  const raw = storageGet(USER_KEY);
  const id = raw ? Number(raw) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

function readStoredProfile(): { name: string | null; email: string | null } {
  const raw = storageGet(USER_PROFILE_KEY);
  if (!raw) return { name: null, email: null };
  try {
    const parsed = JSON.parse(raw) as { name?: unknown; email?: unknown };
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : null,
      email: typeof parsed.email === "string" && parsed.email.trim() ? parsed.email.trim() : null,
    };
  } catch {
    return { name: null, email: null };
  }
}
