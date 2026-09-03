import { createGafaSdk } from "./sdk";
import {
  DEMO_CONCIERGE_CONFIG,
  FITSPIN_CONCIERGE_CONFIG,
  conciergePartnerFixtures,
} from "./sdk/concierge";
import type { ConciergeHandle, ConciergePartnerConfig } from "./sdk/concierge";
import "./sdk/theme/theme.css";
import "./sdk/widgets/widgets.css";

declare global {
  interface Window {
    GafaThemeSDK?: import("./sdk").GafaSdk;
    GafaConciergeBridge: {
      fixtures: typeof conciergePartnerFixtures;
      handle: ConciergeHandle;
      partnerId: string;
      open(): void;
      close(): void;
      destroy(): void;
      switchPartner(partnerId: "fitspin" | "demo-studio"): ConciergeHandle;
    };
  }
}

document.body.style.margin = "0";
document.body.style.background = "#f5efe8";

const sdk = createGafaSdk(
  {
    apiBaseUrl: "https://example.gafa.fit",
    companyId: 1,
    publicClientId: "demo-client",
    theme: {
      preset: "boutique",
      colors: {
        primary: "#16110f",
        primaryText: "#fffaf4",
        accent: "#ff6b2c",
        background: "#f5efe8",
        surface: "#fffaf4",
        text: "#16110f",
        mutedText: "#766b63",
        border: "#eadfd4",
      },
    },
  },
  { useMockClient: true },
);

sdk.mountCalendar("#calendar-demo");
sdk.mountCatalog("#packages-demo", { type: "packages" });
sdk.mountAuth("#auth-demo", { initialView: "login" });
sdk.mountProfile("#profile-demo");

sdk.enablePurchaseButtons();
document.querySelector("#reserve-by-js")?.addEventListener("click", () => {
  sdk.openReservation({ meetingId: 2, brandSlug: "demo-studio", locationSlug: "condesa" });
});

const partnerConfigs: Record<"fitspin" | "demo-studio", ConciergePartnerConfig> = {
  fitspin: FITSPIN_CONCIERGE_CONFIG,
  "demo-studio": DEMO_CONCIERGE_CONFIG,
};

function withLiveCatalog(config: ConciergePartnerConfig): ConciergePartnerConfig {
  return {
    ...config,
    catalog: { ...config.catalog, live: true },
  };
}

function mountConcierge(partnerId: "fitspin" | "demo-studio"): ConciergeHandle {
  return sdk.concierge.mount({
    partnerId,
    config: withLiveCatalog(partnerConfigs[partnerId]),
    hydrateFromClient: true,
    navigate(path) {
      const target = path.includes("paquete") || path.includes("package") || path.includes("#")
        ? document.querySelector("#packages-demo")
        : document.querySelector("#calendar-demo");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });
}

let handle = mountConcierge("fitspin");

window.GafaThemeSDK = sdk;
window.GafaConciergeBridge = {
  fixtures: conciergePartnerFixtures,
  handle,
  partnerId: "fitspin",
  open() {
    this.handle.open();
  },
  close() {
    this.handle.close();
  },
  destroy() {
    this.handle.destroy();
  },
  switchPartner(partnerId) {
    this.handle.destroy();
    handle = mountConcierge(partnerId);
    this.handle = handle;
    this.partnerId = partnerId;
    return handle;
  },
};
