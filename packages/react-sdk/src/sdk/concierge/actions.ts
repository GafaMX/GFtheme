import type {
  ConciergeAction,
  ConciergeActionResult,
  ConciergeActionValidation,
  ConciergeCapability,
  ConciergeCatalogItemRef,
  ConciergeExecutor,
  ConciergeExecutorOptions,
  ConciergeLocationRef,
  ConciergeMeetingRef,
  ConciergePartnerConfig,
} from "./types";
import type { GafaSdk } from "../runtime";

const REQUIRED_CAPABILITIES: Record<ConciergeAction["type"], ConciergeCapability[]> = {
  OPEN_ACCOUNT: ["profile"],
  OPEN_CALENDAR: ["calendar"],
  OPEN_RESERVATION_CHECKOUT: ["calendar", "directReservation"],
  OPEN_CHECKOUT: ["purchase"],
  OPEN_WHATSAPP: ["whatsapp"],
  SHOW_LOCATIONS: ["locations"],
  SHOW_SCHEDULES: ["schedules"],
  SHOW_PRODUCTS: ["purchase"],
};

export function createConciergeExecutor(
  sdk: GafaSdk,
  config: ConciergePartnerConfig,
  options: ConciergeExecutorOptions = {},
): ConciergeExecutor {
  return {
    sdk,
    config,
    validate(action) {
      return validateConciergeAction(config, action, options);
    },
    execute(action) {
      return executeConciergeAction(sdk, config, action, options);
    },
  };
}

export function validateConciergeAction(
  config: ConciergePartnerConfig,
  action: ConciergeAction,
  options: ConciergeExecutorOptions = {},
): ConciergeActionValidation {
  if (action.partnerId !== config.partnerId) {
    return fail("partner_mismatch", `Action partner ${action.partnerId} does not match ${config.partnerId}`);
  }

  const missingCapability = REQUIRED_CAPABILITIES[action.type].find(
    (capability) => config.capabilities[capability] !== true,
  );
  if (missingCapability) {
    return fail("capability_disabled", `Capability ${missingCapability} is disabled for ${config.partnerId}`);
  }

  if ("brandSlug" in action && action.brandSlug && !isBrandAllowed(config, action.brandSlug)) {
    return fail("brand_not_allowed", `Brand ${action.brandSlug} is not allowed for ${config.partnerId}`);
  }

  switch (action.type) {
    case "OPEN_CALENDAR":
      if (action.locationSlug && !findLocation(config, action.locationSlug, action.brandSlug)) {
        return fail("location_not_allowed", `Location ${action.locationSlug} is not allowed`);
      }
      if (!action.targetSelector && !options.calendarTarget && !config.routes?.calendar) {
        return fail("calendar_target_required", "OPEN_CALENDAR requires a target selector or a configured calendar route");
      }
      return { ok: true };

    case "OPEN_RESERVATION_CHECKOUT":
      return validateMeeting(config, action.meeting);

    case "OPEN_CHECKOUT":
      return validateItem(config, action.item);

    case "OPEN_WHATSAPP":
      if (!config.channels?.whatsapp?.phone) {
        return fail("channel_not_configured", `WhatsApp is not configured for ${config.partnerId}`);
      }
      return { ok: true };

    default:
      return { ok: true };
  }
}

export async function executeConciergeAction(
  sdk: GafaSdk,
  config: ConciergePartnerConfig,
  action: ConciergeAction,
  options: ConciergeExecutorOptions = {},
): Promise<ConciergeActionResult> {
  const validation = validateConciergeAction(config, action, options);
  if (!validation.ok) {
    return {
      status: "blocked",
      action: action.type,
      error: validation,
    };
  }

  switch (action.type) {
    case "OPEN_ACCOUNT": {
      const handle = sdk.openAccount({ brandSlug: action.brandSlug });
      return { status: "handled", action: action.type, handle };
    }

    case "OPEN_CALENDAR": {
      const target = action.targetSelector ?? options.calendarTarget;
      if (target) {
        const handle = sdk.mountCalendar(target, {
          filters: {
            brand: Boolean(action.brandSlug),
            location: Boolean(action.locationSlug),
          },
        });
        return { status: "handled", action: action.type, handle };
      }

      const url = config.routes!.calendar!;
      navigateTo(url, options);
      return { status: "handled", action: action.type, url };
    }

    case "OPEN_RESERVATION_CHECKOUT": {
      const handle = await sdk.openReservationCheckout({
        meetingId: action.meeting.meetingId,
        brandSlug: action.meeting.brandSlug,
        locationSlug: action.meeting.locationSlug,
      });
      return { status: "handled", action: action.type, handle };
    }

    case "OPEN_CHECKOUT": {
      const handle = sdk.openCheckout({
        brandSlug: action.item.brandSlug,
        locationSlug: action.item.locationSlug,
        preselect: { type: action.item.kind, id: action.item.id },
        skipCatalog: true,
      });
      return { status: "handled", action: action.type, handle };
    }

    case "OPEN_WHATSAPP": {
      const url = buildWhatsAppUrl(config, action.message);
      navigateTo(url, options);
      return { status: "handled", action: action.type, url };
    }

    case "SHOW_LOCATIONS":
      return { status: "handled", action: action.type, data: config.catalog?.locations ?? [] };

    case "SHOW_SCHEDULES":
      return {
        status: "handled",
        action: action.type,
        data: filterMeetings(config.catalog?.meetings ?? [], action.brandSlug, action.locationSlug),
      };

    case "SHOW_PRODUCTS":
      return {
        status: "handled",
        action: action.type,
        data: (config.catalog?.items ?? []).filter((item) => !action.kind || item.kind === action.kind),
      };

    default:
      return {
        status: "blocked",
        action: action.type,
        error: fail("unsupported_action", `Unsupported action ${(action as { type: string }).type}`),
      };
  }
}

function validateMeeting(config: ConciergePartnerConfig, meeting: ConciergeMeetingRef): ConciergeActionValidation {
  if (!isBrandAllowed(config, meeting.brandSlug)) {
    return fail("brand_not_allowed", `Brand ${meeting.brandSlug} is not allowed for ${config.partnerId}`);
  }

  if (!findLocation(config, meeting.locationSlug, meeting.brandSlug)) {
    return fail("location_not_allowed", `Location ${meeting.locationSlug} is not allowed`);
  }

  const exists = (config.catalog?.meetings ?? []).some(
    (known) =>
      known.meetingId === meeting.meetingId &&
      known.brandSlug === meeting.brandSlug &&
      known.locationSlug === meeting.locationSlug,
  );

  if (!exists) {
    return fail("meeting_not_allowed", `Meeting ${meeting.meetingId} is not allowed for ${config.partnerId}`);
  }

  return { ok: true };
}

function validateItem(config: ConciergePartnerConfig, item: ConciergeCatalogItemRef): ConciergeActionValidation {
  if (!isBrandAllowed(config, item.brandSlug)) {
    return fail("brand_not_allowed", `Brand ${item.brandSlug} is not allowed for ${config.partnerId}`);
  }

  if (item.locationSlug && !findLocation(config, item.locationSlug, item.brandSlug)) {
    return fail("location_not_allowed", `Location ${item.locationSlug} is not allowed`);
  }

  const exists = (config.catalog?.items ?? []).some(
    (known) => known.kind === item.kind && known.id === item.id && known.brandSlug === item.brandSlug,
  );

  if (!exists) {
    return fail("item_not_allowed", `${item.kind} ${item.id} is not allowed for ${config.partnerId}`);
  }

  return { ok: true };
}

function isBrandAllowed(config: ConciergePartnerConfig, brandSlug: string): boolean {
  return config.brandSlugs.includes(brandSlug);
}

function findLocation(
  config: ConciergePartnerConfig,
  locationSlug: string,
  brandSlug?: string,
): ConciergeLocationRef | undefined {
  return (config.catalog?.locations ?? []).find(
    (location) => location.slug === locationSlug && (!brandSlug || location.brandSlug === brandSlug),
  );
}

function filterMeetings(
  meetings: ConciergeMeetingRef[],
  brandSlug?: string,
  locationSlug?: string,
): ConciergeMeetingRef[] {
  return meetings.filter(
    (meeting) =>
      (!brandSlug || meeting.brandSlug === brandSlug) &&
      (!locationSlug || meeting.locationSlug === locationSlug),
  );
}

function buildWhatsAppUrl(config: ConciergePartnerConfig, message?: string): string {
  const channel = config.channels!.whatsapp!;
  const normalizedPhone = channel.phone.replace(/[^\d]/g, "");
  const text = message ?? channel.messageTemplate ?? "";
  const suffix = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${normalizedPhone}${suffix}`;
}

function navigateTo(url: string, options: ConciergeExecutorOptions) {
  if (options.navigate) {
    options.navigate(url);
    return;
  }

  if (typeof window !== "undefined") {
    window.location.assign(url);
  }
}

function fail(code: Exclude<ConciergeActionValidation, { ok: true }>["code"], message: string) {
  return { ok: false as const, code, message };
}
