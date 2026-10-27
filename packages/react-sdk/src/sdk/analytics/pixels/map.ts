import type { SdkAnalyticsEventName, TrackInput } from "../events";
import type { MappedPixelEvent, PixelCommerce, PixelEventName } from "./types";
import { currencyFromUnknown, resolvePixelCurrency } from "./brandCurrency";
import { stablePixelEventId } from "./eventId";

export { currencyFromUnknown, resolvePixelCurrency } from "./brandCurrency";

const COMMERCE_EVENTS: ReadonlySet<PixelEventName> = new Set([
  "view_content",
  "add_to_cart",
  "initiate_checkout",
  "purchase",
]);

const IGNORED: ReadonlySet<SdkAnalyticsEventName> = new Set([
  "reservation.waitlisted",
  "checkout.failed",
]);

const SOURCE_TO_PIXEL: Partial<Record<SdkAnalyticsEventName, PixelEventName>> = {
  page_view: "page_view",
  "catalog.item_opened": "view_content",
  "calendar.meeting_opened": "view_content",
  "cart.item_added": "add_to_cart",
  "checkout.opened": "initiate_checkout",
  "checkout.paid": "purchase",
  "reservation.confirmed": "schedule",
  "auth.registered": "complete_registration",
};

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asStringList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const ids = value.map((item) => String(item)).filter(Boolean);
    return ids.length ? ids : undefined;
  }
  if (value == null || value === "") return undefined;
  return [String(value)];
}

export function commerceFromProps(props: Record<string, unknown> | undefined): PixelCommerce {
  const p = props ?? {};
  const contentType = p.content_type === "class" || p.content_type === "product" ? p.content_type : undefined;
  const ids =
    asStringList(p.content_ids) ??
    asStringList(p.meeting_id) ??
    asStringList(p.item_id) ??
    asStringList(p.id);
  const transactionId = p.transaction_id ?? p.purchase_id;
  return {
    value: asNumber(p.value),
    currency: currencyFromUnknown(p.currency),
    content_ids: ids,
    content_type: contentType ?? (p.meeting_id != null ? "class" : ids ? "product" : undefined),
    num_items: asNumber(p.num_items),
    transaction_id: transactionId != null && transactionId !== "" ? String(transactionId) : undefined,
  };
}

export function mapTrackerEvent(input: TrackInput): MappedPixelEvent | null {
  if (IGNORED.has(input.event)) return null;
  const name = SOURCE_TO_PIXEL[input.event];
  if (!name) return null;
  const eventId = stablePixelEventId(name, input);
  const commerce = commerceFromProps(input.props);
  if (COMMERCE_EVENTS.has(name)) {
    commerce.currency = resolvePixelCurrency(commerce.currency ?? input.props?.currency);
  }
  return {
    name,
    source: input,
    payload: {
      ...commerce,
      event_id: eventId,
    },
  };
}

const PII_KEYS = new Set([
  "email",
  "user_email",
  "phone",
  "telephone",
  "name",
  "user_name",
  "firstName",
  "lastName",
  "first_name",
  "last_name",
]);

export function stripPii<T extends Record<string, unknown>>(input: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (PII_KEYS.has(key)) continue;
    next[key] = value;
  }
  return next as T;
}

export function payloadHasPii(payload: Record<string, unknown>): boolean {
  for (const key of Object.keys(payload)) {
    if (PII_KEYS.has(key)) return true;
  }
  const blob = JSON.stringify(payload).toLowerCase();
  if (blob.includes("@") && /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(blob)) return true;
  return false;
}
