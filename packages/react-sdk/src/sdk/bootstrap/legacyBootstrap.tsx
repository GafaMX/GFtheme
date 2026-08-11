import type { GafaSdk } from "../runtime";
import type { CalendarView } from "../widgets/calendarRange";

type LegacyWidgetName =
  | "login"
  | "register"
  | "password-recovery"
  | "profile-info"
  | "login-register"
  | "login-register-pages"
  | "staff-list"
  | "service-list"
  | "combo-list"
  | "membership-list"
  | "meetings-calendar"
  | "purchase-button"
  | "fancy";

const LEGACY_WIDGETS: LegacyWidgetName[] = [
  "login",
  "register",
  "password-recovery",
  "profile-info",
  "login-register",
  "login-register-pages",
  "staff-list",
  "service-list",
  "combo-list",
  "membership-list",
  "meetings-calendar",
  "purchase-button",
  "fancy",
];

export type LegacyBootstrapResult = {
  mounted: number;
};

export function bootstrapLegacyWidgets(runtime: GafaSdk, root: ParentNode = document): LegacyBootstrapResult {
  let mounted = 0;

  LEGACY_WIDGETS.forEach((widgetName) => {
    root.querySelectorAll<HTMLElement>(`[data-gf-theme="${widgetName}"]`).forEach((element) => {
      mountLegacyWidget(runtime, widgetName, element);
      mounted += 1;
    });
  });

  return { mounted };
}

function mountLegacyWidget(runtime: GafaSdk, widgetName: LegacyWidgetName, element: HTMLElement) {
  switch (widgetName) {
    case "meetings-calendar":
      runtime.mountCalendar(element, {
        limit: toNumber(element.getAttribute("data-gf-limit")),
        // data-bq-calendar-view es el nombre nuevo; data-bq-calendar-visualization
        // se respeta por compatibilidad con los sitios ya integrados.
        view: readCalendarView(element) ?? readVisualization(element),
        allowViewChange: element.getAttribute("data-bq-allow-view-change") !== "false",
        showDescription: element.getAttribute("data-bq-show-description") === "true",
        filters: {
          brand: element.hasAttribute("filter-bq-brand"),
          location: element.hasAttribute("filter-bq-location"),
          service: element.hasAttribute("filter-bq-service"),
          staff: element.hasAttribute("filter-bq-staff"),
          room: element.hasAttribute("filter-bq-room"),
          brandId: toNumber(element.getAttribute("filter-bq-brand-default")),
          locationId: toNumber(element.getAttribute("filter-bq-location-default")),
          serviceId: toNumber(element.getAttribute("filter-bq-service-default")),
          staffId: toNumber(element.getAttribute("filter-bq-staff-default")),
        },
      });
      return;

    case "combo-list":
      runtime.mountCatalog(element, {
        type: "packages",
        filterByName: element.getAttribute("data-gf-filterbyname") || undefined,
        filterByBrand: element.getAttribute("data-buq-brand") || undefined,
      });
      return;

    case "membership-list":
      runtime.mountCatalog(element, {
        type: "memberships",
        filterByName: element.getAttribute("data-gf-filterbyname") || undefined,
        filterByBrand: element.getAttribute("data-buq-brand") || undefined,
      });
      return;

    case "service-list":
      runtime.mountCatalog(element, { type: "services" });
      return;

    case "staff-list":
      runtime.mountCatalog(element, { type: "staff" });
      return;

    case "login":
      runtime.mountAuth(element, { initialView: "login" });
      return;

    case "register":
      runtime.mountAuth(element, { initialView: "register" });
      return;

    case "password-recovery":
      runtime.mountAuth(element, { initialView: "password-recovery" });
      return;

    case "login-register":
    case "login-register-pages":
      runtime.mountAuth(element, {
        initialView: readAuthInitialView(element),
        baseUrl: element.getAttribute("data-gf-base-url") || undefined,
      });
      return;

    case "profile-info":
      runtime.mountProfile(element, {
        combineWaitlist: element.getAttribute("data-bq-combine-waitlist") === "true",
      });
      return;

    case "purchase-button":
      runtime.mountPurchaseButton(element, {
        comboId: element.getAttribute("data-bq-combo-id") || undefined,
        membershipId: element.getAttribute("data-bq-membership-id") || undefined,
        productId: element.getAttribute("data-bq-product-id") || undefined,
        reservationId: element.getAttribute("data-bq-reservation-id") || undefined,
        locationId: element.getAttribute("data-bq-location-id") || undefined,
        defaultStoreTab: element.getAttribute("data-bq-default-store-tab") || undefined,
        noLoading: element.getAttribute("data-bq-no-loading") === "true",
      });
      return;

    case "fancy":
      element.dataset.gafaCheckoutHost = "true";
      return;
  }
}

function readAuthInitialView(element: HTMLElement): "login" | "register" | "password-recovery" | "profile" {
  const initial = element.getAttribute("data-gf-initial");

  if (initial === "register" || initial === "password-recovery" || initial === "profile") {
    return initial;
  }

  return "login";
}

function toNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function readCalendarView(element: HTMLElement): CalendarView | undefined {
  const view = element.getAttribute("data-bq-calendar-view");
  return view === "day" || view === "week" ? view : undefined;
}

/**
 * El legacy tiene `horizontal` (rejilla de dias) y `vertical` (lista de un dia),
 * que es exactamente la distincion entre las vistas de semana y de dia nuevas.
 */
function readVisualization(element: HTMLElement): CalendarView | undefined {
  const visualization = element.getAttribute("data-bq-calendar-visualization");

  if (visualization === "vertical") return "day";
  if (visualization === "horizontal") return "week";

  return undefined;
}
