import type { CheckoutOpenHandle, GafaSdk, MountedWidget } from "../runtime";

export const CONCIERGE_PARTNER_SCHEMA_VERSION = "gafa.concierge.partner.v1";
export const CONCIERGE_ACTION_SCHEMA_VERSION = "gafa.concierge.action.v1";

export type ConciergeCapability =
  | "schedules"
  | "locations"
  | "combos"
  | "memberships"
  | "profile"
  | "directReservation"
  | "whatsapp"
  | "calendar"
  | "purchase";

export type ConciergeCapabilities = Partial<Record<ConciergeCapability, boolean>>;

export type ConciergeThemeConfig = {
  name?: string;
  greeting?: string;
  iconUrl?: string;
  colors?: {
    primary?: string;
    primaryText?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
    mutedText?: string;
    border?: string;
  };
  typography?: {
    fontFamily?: string;
    headingFontFamily?: string;
  };
  radius?: {
    card?: string;
    button?: string;
    modal?: string;
  };
  mode?: "light" | "dark" | "system";
};

export type ConciergeLocationRef = {
  id?: number;
  slug: string;
  brandSlug: string;
  name: string;
};

export type ConciergeMeetingRef = {
  meetingId: number;
  brandSlug: string;
  locationSlug: string;
  startsAt?: string;
  serviceName?: string;
};

export type ConciergeCatalogItemKind = "combo" | "membership" | "product";

export type ConciergeCatalogItemRef = {
  kind: ConciergeCatalogItemKind;
  id: number;
  brandSlug: string;
  locationSlug?: string;
  name: string;
  priceLabel?: string;
};

export type ConciergePartnerCatalog = {
  locations?: ConciergeLocationRef[];
  meetings?: ConciergeMeetingRef[];
  items?: ConciergeCatalogItemRef[];
};

export type ConciergePartnerConfig = {
  schemaVersion: typeof CONCIERGE_PARTNER_SCHEMA_VERSION;
  partnerId: string;
  tenantId?: string;
  companyId: number;
  environment?: "production" | "staging" | "development" | string;
  brandSlugs: string[];
  timezone: string;
  locale?: string;
  allowedOrigins?: string[];
  capabilities: ConciergeCapabilities;
  theme?: ConciergeThemeConfig;
  routes?: {
    calendar?: string;
    packages?: string;
    account?: string;
  };
  channels?: {
    whatsapp?: {
      phone: string;
      label?: string;
      messageTemplate?: string;
    };
  };
  catalog?: ConciergePartnerCatalog;
};

export type ConciergeActionBase = {
  schemaVersion?: typeof CONCIERGE_ACTION_SCHEMA_VERSION;
  partnerId: string;
  id?: string;
};

export type ConciergeAction =
  | (ConciergeActionBase & {
      type: "OPEN_ACCOUNT";
      brandSlug?: string;
    })
  | (ConciergeActionBase & {
      type: "OPEN_CALENDAR";
      brandSlug?: string;
      locationSlug?: string;
      targetSelector?: string | Element;
    })
  | (ConciergeActionBase & {
      type: "OPEN_RESERVATION_CHECKOUT";
      meeting: ConciergeMeetingRef;
    })
  | (ConciergeActionBase & {
      type: "OPEN_CHECKOUT";
      item: ConciergeCatalogItemRef;
    })
  | (ConciergeActionBase & {
      type: "OPEN_WHATSAPP";
      message?: string;
    })
  | (ConciergeActionBase & {
      type: "SHOW_LOCATIONS";
    })
  | (ConciergeActionBase & {
      type: "SHOW_SCHEDULES";
      brandSlug?: string;
      locationSlug?: string;
    })
  | (ConciergeActionBase & {
      type: "SHOW_PRODUCTS";
      kind?: ConciergeCatalogItemKind;
    });

export type ConciergeActionErrorCode =
  | "partner_mismatch"
  | "capability_disabled"
  | "brand_not_allowed"
  | "location_not_allowed"
  | "meeting_not_allowed"
  | "item_not_allowed"
  | "channel_not_configured"
  | "calendar_target_required"
  | "unsupported_action";

export type ConciergeActionValidation =
  | { ok: true }
  | {
      ok: false;
      code: ConciergeActionErrorCode;
      message: string;
    };

export type ConciergeActionResult =
  | {
      status: "handled";
      action: ConciergeAction["type"];
      handle?: CheckoutOpenHandle | MountedWidget | { close(): void };
      url?: string;
      data?: unknown;
    }
  | {
      status: "blocked";
      action: ConciergeAction["type"];
      error: Exclude<ConciergeActionValidation, { ok: true }>;
    };

export type ConciergeExecutorOptions = {
  calendarTarget?: string | Element;
  navigate?: (url: string) => void;
};

export type ConciergeExecutor = {
  sdk: GafaSdk;
  config: ConciergePartnerConfig;
  validate(action: ConciergeAction): ConciergeActionValidation;
  execute(action: ConciergeAction): Promise<ConciergeActionResult>;
};
