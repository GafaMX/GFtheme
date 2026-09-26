export const HUB_EVENT_NAMES = [
  "sdk.heartbeat",
  "widget.mounted",
  "widget.error",
  "calendar.viewed",
  "calendar.filter_changed",
  "calendar.meeting_opened",
  "auth.login_succeeded",
  "auth.login_failed",
  "auth.registered",
  "auth.logged_out",
  "reservation.previewed",
  "reservation.confirmed",
  "reservation.waitlisted",
  "reservation.cancelled",
  "checkout.opened",
  "checkout.paid",
  "checkout.failed",
  "catalog.item_opened",
  "purchase_button.clicked",
  "concierge.opened",
  "concierge.message_sent",
] as const;

export type HubEventName = (typeof HUB_EVENT_NAMES)[number];

export const HUB_EVENT_NAME_SET = new Set<string>(HUB_EVENT_NAMES);

export type IncomingHubEvent = {
  event: string;
  ts?: string;
  session_id?: string;
  company_id: number;
  brand_id?: number | null;
  location_id?: number | null;
  user_id?: number | null;
  widget?: string | null;
  sdk_version?: string | null;
  host?: string | null;
  path?: string | null;
  props?: Record<string, unknown> | null;
};

export type NormalizedHubEvent = {
  event: HubEventName;
  ts: string;
  session_id: string | null;
  company_id: number;
  brand_id: number | null;
  location_id: number | null;
  user_id: number | null;
  widget: string | null;
  sdk_version: string | null;
  host: string | null;
  path: string | null;
  props_json: string | null;
};

export function isHubEventName(value: string): value is HubEventName {
  return HUB_EVENT_NAME_SET.has(value);
}

export function installationKey(input: {
  company_id: number;
  brand_id?: number | null;
  location_id?: number | null;
  host: string;
  path: string;
}): string {
  return [
    input.company_id,
    input.brand_id ?? "",
    input.location_id ?? "",
    input.host.toLowerCase(),
    normalizePath(input.path),
  ].join("|");
}

export function rollupKey(input: {
  day: string;
  company_id: number;
  brand_id?: number | null;
  location_id?: number | null;
  event_name: string;
}): string {
  return [
    input.day,
    input.company_id,
    input.brand_id ?? 0,
    input.location_id ?? 0,
    input.event_name,
  ].join("|");
}

export function normalizePath(path: string | null | undefined): string {
  if (!path) return "/";
  const trimmed = path.split("?")[0] || "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

function asOptionalInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asRequiredInt(value: unknown): number | null {
  const n = asOptionalInt(value);
  return n == null || n <= 0 ? null : n;
}

function asShortString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function normalizeIncomingEvent(
  raw: unknown,
  request: { host?: string | null; path?: string | null },
): NormalizedHubEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const name = typeof input.event === "string" ? input.event : "";
  if (!isHubEventName(name)) return null;

  const company_id = asRequiredInt(input.company_id);
  if (company_id == null) return null;

  const ts =
    typeof input.ts === "string" && !Number.isNaN(Date.parse(input.ts))
      ? new Date(input.ts).toISOString()
      : new Date().toISOString();

  const host = asShortString(input.host, 250) ?? asShortString(request.host, 250);
  const path = normalizePath(asShortString(input.path, 500) ?? request.path);

  let props_json: string | null = null;
  if (input.props && typeof input.props === "object" && !Array.isArray(input.props)) {
    try {
      props_json = JSON.stringify(input.props).slice(0, 4000);
    } catch {
      props_json = null;
    }
  }

  return {
    event: name,
    ts,
    session_id: asShortString(input.session_id, 80),
    company_id,
    brand_id: asOptionalInt(input.brand_id),
    location_id: asOptionalInt(input.location_id),
    user_id: asOptionalInt(input.user_id),
    widget: asShortString(input.widget, 80),
    sdk_version: asShortString(input.sdk_version, 40),
    host,
    path,
    props_json,
  };
}

export function parseEventBatch(
  body: unknown,
  request: { host?: string | null; path?: string | null },
): NormalizedHubEvent[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  const rawList = Array.isArray(record.events)
    ? record.events
    : record.event
      ? [record]
      : [];

  const out: NormalizedHubEvent[] = [];
  for (const item of rawList.slice(0, 50)) {
    const normalized = normalizeIncomingEvent(item, request);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function widgetsFromHeartbeat(event: NormalizedHubEvent): string[] {
  if (event.event !== "sdk.heartbeat" || !event.props_json) return [];
  try {
    const props = JSON.parse(event.props_json) as { widgets?: unknown };
    if (!Array.isArray(props.widgets)) return [];
    return props.widgets.filter((item): item is string => typeof item === "string").slice(0, 30);
  } catch {
    return [];
  }
}
