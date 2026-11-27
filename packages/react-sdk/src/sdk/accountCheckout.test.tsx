import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "./runtime";
import { clearStoredToken, writeStoredToken } from "./client/tokenStorage";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };

let sdk: GafaSdk | null = null;

function boot(): GafaSdk {
  sdk = createGafaSdk(CONFIG, { useMockClient: true });
  return sdk;
}

describe("Comprar desde la cuenta abre el fancy", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
    localStorage.clear();
  });

  it("el CTA Comprar de Mis compras abre paquetes / membresías / productos", async () => {
    writeStoredToken("token-de-prueba");
    boot().openAccount();

    await waitFor(() => {
      expect(document.querySelector(".gafa-account-modal")?.textContent).toContain("Compras");
    });

    const purchasesTab = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Compras",
    );
    expect(purchasesTab).toBeTruthy();
    fireEvent.click(purchasesTab!);

    await waitFor(() => {
      expect(document.querySelector('[aria-label="Comprar paquetes"]')).toBeTruthy();
    });

    fireEvent.click(document.querySelector('[aria-label="Comprar paquetes"]')!);

    await waitFor(() => {
      const checkout = document.querySelector(".gafa-checkout-overlay");
      expect(checkout).toBeTruthy();
      expect(checkout?.textContent).toMatch(/Paquetes/);
      expect(checkout?.textContent).toMatch(/Membresías/);
    });
  });
});

describe("calendario waitlist", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
    localStorage.clear();
  });

  it("pinta Waitlist en la tarjeta de una clase llena", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    boot().mountCalendar(host);

    await waitFor(() => {
      expect(host.querySelector(".gafa-availability-pill--waitlist")?.textContent).toMatch(
        /Waitlist|Lista de espera/,
      );
    });
    expect(host.querySelector(".gafa-meeting-card[data-waitlist='true']")).toBeTruthy();
  });
});
