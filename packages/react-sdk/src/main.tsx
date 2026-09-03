import { createGafaSdk } from "./sdk";
import "./sdk/theme/theme.css";
import "./sdk/widgets/widgets.css";

document.body.style.margin = "0";
document.body.style.background = "#f5efe8";

const sdk = createGafaSdk(
  {
    apiBaseUrl: "https://example.gafa.fit",
    companyId: 1,
    publicClientId: "demo-client",
    theme: {
      preset: "boutique",
      logoUrl:
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="#f2c545"/><text x="256" y="330" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="260" font-weight="800" fill="#16110f">S</text></svg>',
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

// Reserva de una clase por id: por atributo (data-gf-reserve) y por JS.
sdk.enablePurchaseButtons();
document.querySelector("#reserve-by-js")?.addEventListener("click", () => {
  sdk.openReservation({ meetingId: 2, brandSlug: "demo-studio", locationSlug: "condesa" });
});

// Para probar la API desde la consola del navegador, igual que en un sitio real.
window.GafaThemeSDK = sdk;
