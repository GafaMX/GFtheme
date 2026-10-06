export const SDK_ANALYTICS_EVENTS = [
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

export type SdkAnalyticsEventName = (typeof SDK_ANALYTICS_EVENTS)[number];

export type SdkAnalyticsEvent = {
  event: SdkAnalyticsEventName;
  ts: string;
  session_id: string;
  company_id: number;
  brand_id?: number | null;
  location_id?: number | null;
  user_id?: number | null;
  widget?: string | null;
  sdk_version: string;
  host?: string | null;
  path?: string | null;
  props?: Record<string, unknown>;
};

export type TrackInput = {
  event: SdkAnalyticsEventName;
  brand_id?: number | null;
  location_id?: number | null;
  user_id?: number | null;
  widget?: string | null;
  props?: Record<string, unknown>;
};
