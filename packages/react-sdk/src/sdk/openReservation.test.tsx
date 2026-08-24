import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "./runtime";
import { clearStoredToken, writeStoredToken } from "./client/tokenStorage";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };

let sdk: GafaSdk | null = null;

function boot(): GafaSdk {
  sdk = createGafaSdk(CONFIG, { useMockClient: true });
  return sdk;
}

/** El detalle de la clase (y el gate de login) viven en el overlay de reserva. */
function overlayText() {
  return document.querySelector(".gafa-reservation-overlay")?.textContent ?? "";
}

describe("openReservation", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
    localStorage.clear();
  });

  it("abre el detalle de una clase por id, sin calendario montado", async () => {
    writeStoredToken("token-de-prueba");
    boot().openReservation({ meetingId: 1, brandSlug: "demo-studio", locationSlug: "roma-norte" });

    await waitFor(() => {
      expect(overlayText()).toContain("Detalle de reserva");
      expect(overlayText()).toContain("Coach Demo");
    });
  });

  it("sin sesion pide login antes del detalle, igual que el calendario", async () => {
    boot().openReservation({ meetingId: 1 });

    await waitFor(() => {
      expect(overlayText()).toContain("Inicia sesión para reservar");
      expect(overlayText()).toContain("Functional Training");
    });
  });

  it("el contrato viejo client.openReservationCheckout abre el mismo modal", async () => {
    writeStoredToken("token-de-prueba");
    await boot().client.openReservationCheckout({
      meetingId: 2,
      brandSlug: "demo-studio",
      locationSlug: "condesa",
    });

    await waitFor(() => {
      expect(overlayText()).toContain("Detalle de reserva");
      expect(overlayText()).toContain("Coach Ana");
    });
  });

  it("avisa cuando la clase ya no esta publicada", async () => {
    boot().openReservation({ meetingId: 404 });

    await waitFor(() => {
      expect(overlayText()).toContain("No encontramos esa clase");
    });
  });

  it("un boton [data-gf-reserve] de la pagina abre la reserva", async () => {
    writeStoredToken("token-de-prueba");
    boot().enablePurchaseButtons();

    document.body.innerHTML = `<button data-gf-reserve data-gf-meeting-id="1">Reservar</button>`;
    document.querySelector("button")?.click();

    await waitFor(() => {
      expect(overlayText()).toContain("Detalle de reserva");
      expect(overlayText()).toContain("Coach Demo");
    });
  });

  it("no apila modales: abrir otra clase reemplaza la anterior", async () => {
    writeStoredToken("token-de-prueba");
    const instance = boot();
    const first = instance.openReservation({ meetingId: 1 });
    await waitFor(() => expect(overlayText()).toContain("Coach Demo"));

    instance.openReservation({ meetingId: 2 });
    await waitFor(() => {
      expect(document.querySelectorAll(".gafa-reservation-overlay")).toHaveLength(1);
      expect(overlayText()).toContain("Coach Ana");
    });

    first.close();
    await waitFor(() => {
      expect(document.querySelectorAll(".gafa-reservation-overlay")).toHaveLength(1);
    });
  });

  it("en una clase llena sin crédito que aplique lleva a comprar para la waitlist", async () => {
    writeStoredToken("token-de-prueba");
    boot().openReservation({ meetingId: 2, brandSlug: "demo-studio", locationSlug: "condesa" });

    await waitFor(() => {
      expect(overlayText()).toContain("Lista de espera");
      expect(overlayText()).toContain("Comprar y unirme a la lista");
    });

    const buy = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Comprar y unirme a la lista"),
    );
    expect(buy).toBeTruthy();
    buy?.click();

    await waitFor(() => {
      const checkout = document.querySelector(".gafa-checkout-overlay")?.textContent ?? "";
      expect(checkout).toMatch(/lista de espera/i);
      expect(checkout).toMatch(/Paquetes/);
    });
  });

  it("con crédito válido el CTA une a la waitlist y confirma la espera", async () => {
    writeStoredToken("token-de-prueba");
    const { createMockGafaClient } = await import("./client/gafaClient");
    const mock = createMockGafaClient();
    const client = {
      ...mock,
      getReservationContext: async (payload: Parameters<NonNullable<typeof mock.getReservationContext>>[0]) => {
        const context = await mock.getReservationContext!(payload);
        return {
          ...context,
          waitlistAvailable: true,
          paymentOptions: [
            { id: "credits--1--2099-01-01", kind: "credit" as const, name: "10 clases", remaining: 5 },
          ],
        };
      },
    };
    sdk = createGafaSdk(CONFIG, { client });
    sdk.openReservation({ meetingId: 2, brandSlug: "demo-studio", locationSlug: "condesa" });

    await waitFor(() => {
      expect(overlayText()).toContain("Unirme a la lista de espera");
    });

    const join = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Unirme a la lista de espera"),
    );
    join?.click();

    await waitFor(() => {
      expect(overlayText()).toContain("Estás en la lista de espera");
    });
  });
});
