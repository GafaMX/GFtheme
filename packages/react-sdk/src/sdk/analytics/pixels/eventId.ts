import type { TrackInput } from "../events";
import type { PixelEventName } from "./types";

const SENT_KEY = "gafa-sdk:pixel-sent";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function readProp(props: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!props) return undefined;
  for (const key of keys) {
    const value = props[key];
    if (value == null || value === "") continue;
    return String(value);
  }
  return undefined;
}

export function stablePixelEventId(name: PixelEventName, input: TrackInput): string {
  if (name === "purchase") {
    const purchaseId = readProp(input.props, ["purchase_id", "transaction_id"]);
    if (purchaseId) return `buq_purchase_${purchaseId}`;
  }
  if (name === "schedule") {
    const reservationId = readProp(input.props, ["reservation_id"]);
    if (reservationId) return `buq_schedule_${reservationId}`;
  }
  const existing = readProp(input.props, ["event_id"]);
  if (existing) return existing;
  return `buq_${name}_${randomId()}`;
}

function readSent(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SENT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((item) => typeof item === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeSent(ids: Set<string>): void {
  try {
    sessionStorage.setItem(SENT_KEY, JSON.stringify([...ids]));
  } catch {
    // private mode
  }
}

export function shouldSendOnce(name: PixelEventName, eventId: string): boolean {
  if (name !== "purchase" && name !== "schedule") return true;
  const sent = readSent();
  if (sent.has(eventId)) return false;
  sent.add(eventId);
  writeSent(sent);
  return true;
}

/**
 * Una PageView por carga, otra solo si cambia `props.view`.
 * El `page_view` de boot (`__load__`) y el eco de la vista inicial se fusionan.
 */
export function createPageViewGate() {
  let lastKey: string | null = null;
  return {
    allow(input: TrackInput): boolean {
      const view = typeof input.props?.view === "string" ? input.props.view.trim() : "";
      const key = view || "__load__";
      if (lastKey === key) return false;
      if (lastKey === "__load__" && view) {
        lastKey = key;
        return false;
      }
      lastKey = key;
      return true;
    },
    reset() {
      lastKey = null;
    },
  };
}

export function resetPixelDedupForTests(): void {
  try {
    sessionStorage.removeItem(SENT_KEY);
  } catch {
    // ignore
  }
}
