import { createGafaSdk } from "./sdk";
import {
  createConciergeExecutor,
  conciergePartnerFixtures,
  fitspinConciergeFixture,
} from "./sdk/concierge";
import "./sdk/theme/theme.css";
import "./sdk/widgets/widgets.css";

declare global {
  interface Window {
    GafaConciergeBridge: {
      fixtures: typeof conciergePartnerFixtures;
      executor: ReturnType<typeof createConciergeExecutor>;
      reserveFitspinDemo(): Promise<unknown>;
      buyFitspinDemo(): Promise<unknown>;
      whatsappFitspinDemo(): Promise<unknown>;
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

// Reserva de una clase por id: por atributo (data-gf-reserve) y por JS.
sdk.enablePurchaseButtons();
document.querySelector("#reserve-by-js")?.addEventListener("click", () => {
  sdk.openReservation({ meetingId: 2, brandSlug: "demo-studio", locationSlug: "condesa" });
});

// Para probar la API desde la consola del navegador, igual que en un sitio real.
window.GafaThemeSDK = sdk;
window.GafaConciergeBridge = {
  fixtures: conciergePartnerFixtures,
  executor: createConciergeExecutor(sdk, fitspinConciergeFixture, {
    calendarTarget: "#calendar-demo",
  }),
  reserveFitspinDemo() {
    return this.executor.execute({
      partnerId: "fitspin",
      type: "OPEN_RESERVATION_CHECKOUT",
      meeting: fitspinConciergeFixture.catalog!.meetings![0],
    });
  },
  buyFitspinDemo() {
    return this.executor.execute({
      partnerId: "fitspin",
      type: "OPEN_CHECKOUT",
      item: fitspinConciergeFixture.catalog!.items![0],
    });
  },
  whatsappFitspinDemo() {
    return this.executor.execute({
      partnerId: "fitspin",
      type: "OPEN_WHATSAPP",
      message: "Hola, quiero ayuda con mi reserva.",
    });
  },
};
