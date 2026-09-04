import { createGafaSdk } from "./sdk";
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

// Reserva de una clase por id: por atributo (data-gf-reserve) y por JS.
sdk.enablePurchaseButtons();
document.querySelector("#reserve-by-js")?.addEventListener("click", () => {
  sdk.openReservation({ meetingId: 2, brandSlug: "demo-studio", locationSlug: "condesa" });
});

// Para probar la API desde la consola del navegador, igual que en un sitio real.
window.GafaThemeSDK = sdk;
