import { createGafaSdk } from "./sdk";

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
