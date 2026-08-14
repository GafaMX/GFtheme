/**
 * Bundle drop-in para WordPress / Elementor: un <script> que lee
 * [data-gafa-options] o [data-gf-options], monta los contenedores
 * [data-gafa-v2] y deja window.GafaSdk listo.
 *
 * data-gafa-v2 (no data-gf-theme) para no pelear con el SDK v1 que
 * ya vive en el header del sitio.
 */
import { createGafaSdk } from "./runtime";
import { readLegacyOptionsFromDom } from "./config";
import "./theme/theme.css";
import "./widgets/widgets.css";

type V2Widget =
  | "meetings-calendar"
  | "combo-list"
  | "membership-list"
  | "login-register"
  | "staff-list"
  | "service-list"
  | "profile-info";

function boot() {
  const config = readLegacyOptionsFromDom();
  const sdk = createGafaSdk(config);
  window.GafaSdk = sdk;

  document.querySelectorAll<HTMLElement>("[data-gafa-v2]").forEach((element) => {
    const widget = (element.getAttribute("data-gafa-v2") || "").trim() as V2Widget;
    switch (widget) {
      case "meetings-calendar":
        sdk.mountCalendar(element, {
          filters: {
            location: element.hasAttribute("filter-bq-location"),
            service: element.hasAttribute("filter-bq-service"),
            staff: element.hasAttribute("filter-bq-staff"),
            room: element.hasAttribute("filter-bq-room"),
            brand: element.hasAttribute("filter-bq-brand"),
          },
        });
        return;
      case "combo-list":
        sdk.mountCatalog(element, {
          type: "packages",
          onBuy: (item) =>
            sdk.openCheckout({
              brandSlug: item.brandSlug,
              preselect: { type: "combo", id: item.id },
              skipCatalog: true,
            }),
        });
        return;
      case "membership-list":
        sdk.mountCatalog(element, {
          type: "memberships",
          onBuy: (item) =>
            sdk.openCheckout({
              brandSlug: item.brandSlug,
              preselect: { type: "membership", id: item.id },
              skipCatalog: true,
            }),
        });
        return;
      case "login-register":
        sdk.mountHeaderControls(element);
        return;
      case "staff-list":
        sdk.mountCatalog(element, { type: "staff" });
        return;
      case "service-list":
        sdk.mountCatalog(element, { type: "services" });
        return;
      case "profile-info":
        sdk.mountProfile(element);
        return;
      default:
        return;
    }
  });

  sdk.enablePurchaseButtons();
}

declare global {
  interface Window {
    GafaSdk?: ReturnType<typeof createGafaSdk>;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
