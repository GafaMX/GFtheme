import type { GafaSdk } from "../runtime";
import { readFilterFlag } from "../bootstrap/legacyFilterFlag";
import { readConciergeConfigFromDom } from "../concierge/domConfig";
import type { CalendarView } from "./calendarRange";
import { readCalendarLocationIdFromWindow } from "./calendarLocationQuery";

export type WidgetStatus = "stable" | "beta" | "preview";

export type WidgetDefinition = {
  id: string;
  shortcode: string;
  title: string;
  status: WidgetStatus;
  description: string;
  mount?: (runtime: GafaSdk, element: HTMLElement) => void;
};

export const WIDGET_CATALOG: WidgetDefinition[] = [
  {
    id: "meetings-calendar",
    shortcode: "meetings-calendar",
    title: "Calendario",
    status: "stable",
    description: "Clases por día o semana, filtros y reserva.",
    mount: mountCalendar,
  },
  {
    id: "combo-list",
    shortcode: "combo-list",
    title: "Paquetes",
    status: "stable",
    description: "Lista de combos / paquetes de créditos.",
    mount: mountComboList,
  },
  {
    id: "membership-list",
    shortcode: "membership-list",
    title: "Membresías",
    status: "stable",
    description: "Lista de membresías.",
    mount: mountMembershipList,
  },
  {
    id: "staff-list",
    shortcode: "staff-list",
    title: "Staff",
    status: "stable",
    description: "Lista de coaches.",
    mount: (runtime, element) => runtime.mountCatalog(element, { type: "staff" }),
  },
  {
    id: "service-list",
    shortcode: "service-list",
    title: "Servicios",
    status: "stable",
    description: "Lista de servicios.",
    mount: (runtime, element) => runtime.mountCatalog(element, { type: "services" }),
  },
  {
    id: "login",
    shortcode: "login",
    title: "Login",
    status: "stable",
    description: "Formulario de inicio de sesión.",
    mount: (runtime, element) => runtime.mountAuth(element, { initialView: "login" }),
  },
  {
    id: "register",
    shortcode: "register",
    title: "Registro",
    status: "stable",
    description: "Formulario de registro.",
    mount: (runtime, element) => runtime.mountAuth(element, { initialView: "register" }),
  },
  {
    id: "password-recovery",
    shortcode: "password-recovery",
    title: "Recuperar contraseña",
    status: "stable",
    description: "Solicitud de reset.",
    mount: (runtime, element) => runtime.mountAuth(element, { initialView: "password-recovery" }),
  },
  {
    id: "login-register",
    shortcode: "login-register",
    title: "Mi cuenta (header)",
    status: "stable",
    description: "Botón de cuenta + carrito en el header.",
    mount: (runtime, element) =>
      runtime.mountHeaderControls(element, {
        combineWaitlist: element.getAttribute("data-bq-combine-waitlist") === "true",
      }),
  },
  {
    id: "login-register-pages",
    shortcode: "login-register-pages",
    title: "Auth en página",
    status: "stable",
    description: "Login / registro inline.",
    mount: (runtime, element) =>
      runtime.mountAuth(element, {
        initialView: readAuthInitialView(element),
        baseUrl: element.getAttribute("data-gf-base-url") || undefined,
      }),
  },
  {
    id: "profile-info",
    shortcode: "profile-info",
    title: "Perfil",
    status: "stable",
    description: "Reservas, créditos, compras.",
    mount: (runtime, element) =>
      runtime.mountProfile(element, {
        combineWaitlist: element.getAttribute("data-bq-combine-waitlist") === "true",
      }),
  },
  {
    id: "purchase-button",
    shortcode: "purchase-button",
    title: "Botón de compra",
    status: "stable",
    description: "Abre el checkout nativo.",
    mount: mountPurchaseButton,
  },
  {
    id: "fancy",
    shortcode: "fancy",
    title: "Host de checkout",
    status: "stable",
    description: "Contenedor legacy; el checkout V2 no lo necesita.",
    mount: (_runtime, element) => {
      element.dataset.gafaCheckoutHost = "true";
    },
  },
  {
    id: "concierge",
    shortcode: "concierge",
    title: "Concierge",
    status: "stable",
    description: "Barra + chat. Off salvo nodo HTML y CONCIERGE en options.",
    mount: mountConcierge,
  },
];

export const WIDGET_BY_SHORTCODE = new Map(WIDGET_CATALOG.map((widget) => [widget.shortcode, widget]));

export function bootstrapableWidgets(): WidgetDefinition[] {
  return WIDGET_CATALOG.filter((widget) => widget.mount);
}

export function mountRegisteredWidget(runtime: GafaSdk, shortcode: string, element: HTMLElement): boolean {
  const widget = WIDGET_BY_SHORTCODE.get(shortcode);
  if (!widget?.mount) return false;
  widget.mount(runtime, element);
  return true;
}

function mountConcierge(runtime: GafaSdk, element: HTMLElement) {
  const { config } = readConciergeConfigFromDom(element.ownerDocument ?? document, element);
  runtime.concierge.mount({
    config,
    container: element,
    webview: element.getAttribute("data-gafa-webview") === "true" || element.getAttribute("data-gf-webview") === "true",
    hydrateFromClient: readLiveFlag(element),
  });
}

function readLiveFlag(element: HTMLElement): boolean | undefined {
  const live = element.getAttribute("data-gafa-concierge-live") ?? element.getAttribute("data-gf-concierge-live");
  if (live == null) return undefined;
  return live !== "false";
}

function mountCalendar(runtime: GafaSdk, element: HTMLElement) {
  runtime.mountCalendar(element, {
    limit: toNumber(element.getAttribute("data-gf-limit")),
    view: readCalendarView(element) ?? readVisualization(element),
    allowViewChange: element.getAttribute("data-bq-allow-view-change") !== "false",
    showDescription: element.getAttribute("data-bq-show-description") === "true",
    filters: {
      brand: element.hasAttribute("filter-bq-brand"),
      location: element.hasAttribute("filter-bq-location"),
      service: readFilterFlag(element, "filter-bq-service", true),
      staff: readFilterFlag(element, "filter-bq-staff", true),
      room: element.hasAttribute("filter-bq-room"),
      brandId: toNumber(element.getAttribute("filter-bq-brand-default")),
      locationId: readCalendarLocationIdFromWindow() ?? toNumber(element.getAttribute("filter-bq-location-default")),
      serviceId: toNumber(element.getAttribute("filter-bq-service-default")),
      staffId: toNumber(element.getAttribute("filter-bq-staff-default")),
    },
  });
}

function mountComboList(runtime: GafaSdk, element: HTMLElement) {
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
}

function mountMembershipList(runtime: GafaSdk, element: HTMLElement) {
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
}

function mountPurchaseButton(runtime: GafaSdk, element: HTMLElement) {
  const comboId = element.getAttribute("data-bq-combo-id") || element.getAttribute("data-gf-combo-id");
  const membershipId = element.getAttribute("data-bq-membership-id") || element.getAttribute("data-gf-membership-id");
  const productId = element.getAttribute("data-bq-product-id") || element.getAttribute("data-gf-product-id");
  const locationId = element.getAttribute("data-bq-location-id") || element.getAttribute("data-gf-location-id");
  const locationSlug = element.getAttribute("data-gf-location") || element.getAttribute("data-bq-location");
  const brandSlug = element.getAttribute("data-gf-brand") || element.getAttribute("data-buq-brand");

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
}

function readAuthInitialView(element: HTMLElement): "login" | "register" | "password-recovery" | "profile" {
  const initial = element.getAttribute("data-gf-initial");
  if (initial === "register" || initial === "password-recovery" || initial === "profile") {
    return initial;
  }
  return "login";
}

function toNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function readCalendarView(element: HTMLElement): CalendarView | undefined {
  const view = element.getAttribute("data-bq-calendar-view");
  return view === "day" || view === "week" ? view : undefined;
}

function readVisualization(element: HTMLElement): CalendarView | undefined {
  const visualization = element.getAttribute("data-bq-calendar-visualization");
  if (visualization === "vertical") return "day";
  if (visualization === "horizontal") return "week";
  return undefined;
}
