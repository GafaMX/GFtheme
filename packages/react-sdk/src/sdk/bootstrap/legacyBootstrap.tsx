import type { GafaSdk } from "../runtime";
import type { CalendarView } from "../widgets/calendarRange";
import { readCalendarLocationIdFromWindow } from "../widgets/calendarLocationQuery";

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

  // Los [data-gf-theme="purchase-button"] y [data-gf-buy] escuchan por
  // delegacion: una sola vez, aunque el socio vuelva a llamar bootstrap.
  runtime.enablePurchaseButtons(root instanceof Element ? root : undefined);

  LEGACY_WIDGETS.forEach((widgetName) => {
    root.querySelectorAll<HTMLElement>(`[data-gf-theme="${widgetName}"]`).forEach((element) => {
      mountLegacyWidget(runtime, widgetName, element);
      mounted += 1;
    });
  });

  // El mail de "restablecer contraseña" llega con ?token=&email= a la home,
  // que en los sitios viejos solo tiene el boton de cuenta en el header.
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("token") && params.get("email")) {
      runtime.openAccount();
    }
  }

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
          // Servicio y coach se filtran siempre que haya opciones: Fitspin
          // (y casi todo estudio) los espera. Marca/sala siguen opt-in.
          service: readFilterFlag(element, "filter-bq-service", true),
          staff: readFilterFlag(element, "filter-bq-staff", true),
          room: element.hasAttribute("filter-bq-room"),
          brandId: toNumber(element.getAttribute("filter-bq-brand-default")),
          locationId:
            readCalendarLocationIdFromWindow() ?? toNumber(element.getAttribute("filter-bq-location-default")),
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
        onBuy: (item) =>
          runtime.openCheckout({
            brandSlug: item.brandSlug,
            preselect: { type: "combo", id: item.id },
            skipCatalog: true,
          }),
      });
      return;

    case "membership-list":
      runtime.mountCatalog(element, {
        type: "memberships",
        filterByName: element.getAttribute("data-gf-filterbyname") || undefined,
        filterByBrand: element.getAttribute("data-buq-brand") || undefined,
        onBuy: (item) =>
          runtime.openCheckout({
            brandSlug: item.brandSlug,
            preselect: { type: "membership", id: item.id },
            skipCatalog: true,
          }),
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
      runtime.mountHeaderControls(element, {
        combineWaitlist: element.getAttribute("data-bq-combine-waitlist") === "true",
      });
      return;

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

    case "purchase-button": {
      const comboId = element.getAttribute("data-bq-combo-id") || element.getAttribute("data-gf-combo-id");
      const membershipId =
        element.getAttribute("data-bq-membership-id") || element.getAttribute("data-gf-membership-id");
      const productId = element.getAttribute("data-bq-product-id") || element.getAttribute("data-gf-product-id");
      const locationId = element.getAttribute("data-bq-location-id") || element.getAttribute("data-gf-location-id");
      const locationSlug = element.getAttribute("data-gf-location") || element.getAttribute("data-bq-location");
      const brandSlug = element.getAttribute("data-gf-brand") || element.getAttribute("data-buq-brand");

      // Sitio con boton propio (Fitspin COMPRAR): no reemplazar el HTML, solo
      // marcar el host para que enablePurchaseButtons abra el checkout nativo.
      const hasOwnTrigger = Boolean(element.querySelector("button, a") || element.textContent?.trim());
      if (hasOwnTrigger) {
        element.setAttribute("data-gf-buy", "");
        if (comboId) element.setAttribute("data-gf-combo-id", comboId);
        if (membershipId) element.setAttribute("data-gf-membership-id", membershipId);
        if (productId) element.setAttribute("data-gf-product-id", productId);
        if (locationSlug) element.setAttribute("data-gf-location", locationSlug);
        if (locationId) element.setAttribute("data-gf-location-id", locationId);
        if (brandSlug) element.setAttribute("data-gf-brand", brandSlug);
        return;
      }

      runtime.mountPurchaseButton(element, {
        comboId: comboId || undefined,
        membershipId: membershipId || undefined,
        productId: productId || undefined,
        reservationId: element.getAttribute("data-bq-reservation-id") || undefined,
        locationId: locationId || undefined,
        brandSlug: brandSlug || undefined,
        defaultStoreTab: element.getAttribute("data-bq-default-store-tab") || undefined,
        noLoading: element.getAttribute("data-bq-no-loading") === "true",
      });
      return;
    }

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

/** Ausente = defaultOn. `false`/`0` apaga. Cualquier otro valor (o el attr vacío) enciende. */
export function readFilterFlag(element: Element, name: string, defaultOn: boolean): boolean {
  if (!element.hasAttribute(name)) return defaultOn;
  const value = (element.getAttribute(name) ?? "").trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off" || value === "no") return false;
  return true;
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
