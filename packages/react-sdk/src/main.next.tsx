import { createGafaSdk } from "./sdk";
import "./sdk/theme/theme.css";
import "./sdk/widgets/widgets.css";

declare global {
  interface Window {
    GafaThemeSDK?: import("./sdk").GafaSdk;
  }
}

const sdk = createGafaSdk(
  {
    companyId: 9001,
    publicClientId: "buq-next-preview",
    environment: "next-dev",
    backend: "buq-next",
    analyticsEnabled: false,
    theme: {
      preset: "boutique",
      colorScheme: "light",
      allowUserColorScheme: false,
      colors: {
        primary: "#16352b",
        primaryText: "#f4f1ea",
        accent: "#c4a35a",
        background: "#f4f1ea",
        surface: "#fffaf4",
        text: "#16352b",
        mutedText: "#6d655c",
        border: "#d9d0c3",
      },
    },
  },
  { backend: "buq-next" },
);

sdk.mountCalendar("#calendar-next", { filters: { location: true, service: true, staff: true } });
sdk.mountCatalog("#packages-next", { type: "packages" });
sdk.mountCatalog("#memberships-next", { type: "memberships" });
sdk.mountCatalog("#staff-next", { type: "staff" });
sdk.mountAuth("#auth-next", { initialView: "login" });
sdk.mountProfile("#profile-next");
sdk.enablePurchaseButtons();

window.GafaThemeSDK = sdk;
