import { createGafaSdk } from "./sdk";
import "./sdk/theme/theme.css";
import "./sdk/widgets/widgets.css";

document.body.style.margin = "0";
document.body.style.background = "#f8fafc";

const sdk = createGafaSdk(
  {
    apiBaseUrl: "https://example.gafa.fit",
    companyId: 1,
    publicClientId: "demo-client",
    theme: {
      preset: "boutique",
      logoUrl: "/vite.svg",
      colors: {
        primary: "#111827",
        accent: "#f97316",
      },
    },
  },
  { useMockClient: true },
);

sdk.mountCalendar("#calendar-demo");
sdk.mountCatalog("#packages-demo", { type: "packages" });
sdk.mountAuth("#auth-demo", { initialView: "login" });
sdk.mountProfile("#profile-demo");
