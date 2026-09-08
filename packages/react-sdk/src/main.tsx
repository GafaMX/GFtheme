import { createGafaSdk } from "./sdk";
import {
  DEMO_CONCIERGE_CONFIG,
  FITSPIN_CONCIERGE_CONFIG,
  conciergePartnerFixtures,
} from "./sdk/concierge";
import type { ConciergeHandle, ConciergePartnerConfig } from "./sdk/concierge";
import "./sdk/theme/theme.css";
import "./sdk/widgets/widgets.css";

const params = new URLSearchParams(window.location.search);
const isBaseTheme = params.get("theme") === "base";
const theBaseColors = {
  brand: "#F3D15E",
  accent: "#F3D15E",
  background: "#171C35",
  surface: "#1E2444",
  surfaceRaised: "#252C50",
  text: "#FFFFFF",
  mutedText: "#AEB4CB",
  border: "#394165",
  inputBackground: "#171C35",
  inputText: "#FFFFFF",
  inputBorder: "#394165",
};

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
document.body.style.background = isBaseTheme ? "#171C35" : "#f5efe8";

const sdk = createGafaSdk(
  {
    apiBaseUrl: "https://example.gafa.fit",
    companyId: 1,
    publicClientId: "demo-client",
    theme: isBaseTheme
      ? {
          colorScheme: "dark",
          allowUserColorScheme: false,
          colors: theBaseColors,
        }
      : {
          preset: "boutique",
          logoUrl:
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="#f2c545"/><text x="256" y="330" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="260" font-weight="800" fill="#16110f">S</text></svg>',
            ),
          logoUrlDark:
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="44"><text x="0" y="34" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28" font-weight="800" fill="#fffaf4">DEMO STUDIO</text></svg>',
            ),
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
