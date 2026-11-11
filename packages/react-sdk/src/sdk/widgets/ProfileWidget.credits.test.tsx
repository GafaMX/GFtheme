import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { GafaClient, UserCredit, UserProfile } from "../client/types";
import { ProfileWidget } from "./ProfileWidget";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  }
});

afterEach(() => cleanup());

const gabrielCredits: UserCredit[] = [
  { id: 863994, creditTypeId: 509, name: "1 clase", total: 1, expiresAt: "2026-09-17" },
  { id: 864298, creditTypeId: 509, name: "1 clase", total: 1, expiresAt: "2026-09-18" },
  { id: 865028, creditTypeId: 509, name: "1 clase", total: 1, expiresAt: "2026-09-19" },
  { id: 856509, creditTypeId: 509, name: "5 Clases", total: 1, expiresAt: "2026-10-10" },
];

const profile: UserProfile = {
  id: 370466,
  name: "Gabriel Arrechea",
  firstName: "Gabriel",
  lastName: "Arrechea",
  email: "gabriel+fitspin@buq.mx",
  storeCreditTotal: "0",
};

function mockClient(credits: UserCredit[] = gabrielCredits): GafaClient {
  return {
    getProfile: async () => profile,
    listBrands: async () => [{ id: 86, name: "Fitspin CDMX", slug: "fitspin" }],
    listUserCredits: async () => credits,
    listUserMemberships: async () => [],
    listUserReservations: async () => [],
    listUserPurchases: async () => [],
    listLocations: async () => [],
    listServices: async () => [],
    listStaff: async () => [],
    listCombos: async () => [],
    listMemberships: async () => [],
    listMeetings: async () => [],
    listRegistrationFields: async () => [],
    cancelReservation: async () => undefined,
    getUserActivityTotals: async () => ({
      reservedCount: 0,
      attendedCount: 0,
      noShowCount: 0,
      cancelledCount: 0,
      attendedMinutes: 0,
      favoriteStaff: [],
      favoriteSchedules: [],
    }),
    logout: () => undefined,
  } as GafaClient;
}

function renderProfile(credits?: UserCredit[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileWidget client={mockClient(credits)} brandSlug="fitspin" />
    </QueryClientProvider>,
  );
}

describe("perfil: paquetes por compra, no por tipo de credito", () => {
  it("en Mi actividad muestra el total y el slider de cada paquete", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("4")).toBeTruthy();
    });

    const carousel = document.querySelector('[data-carousel="true"]');
    expect(carousel).toBeTruthy();
    expect(carousel?.querySelector(".gafa-acct-balance__value")?.textContent).toBe("4");
    expect(carousel?.textContent).toMatch(/Clases disponibles/);
    expect(carousel?.textContent).toMatch(/1 clase/);
    expect(carousel?.textContent).toMatch(/1\s*\/\s*4/);

    fireEvent.click(screen.getByRole("button", { name: "Paquete siguiente" }));
    expect(carousel?.textContent).toMatch(/1\s*\/\s*4|2\s*\/\s*4/);
    expect(carousel?.querySelector(".gafa-acct-balance__value")?.textContent).toBe("4");
  });

  it("en Creditos lista cada paquete y un total", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("4")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Créditos" }));

    await waitFor(() => {
      expect(screen.getByText("Total disponible")).toBeTruthy();
    });

    expect(screen.getByText("4 paquetes activos")).toBeTruthy();
    expect(screen.getByLabelText("Total de clases disponibles").textContent).toMatch(/4/);
    expect(screen.getAllByRole("heading", { level: 4, name: "1 clase" })).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 4, name: "5 Clases" })).toBeTruthy();
  });

  it("con un solo paquete no inventa slider y sigue mostrando el saldo", async () => {
    renderProfile([{ id: 1, creditTypeId: 509, name: "5 Clases", total: 1, expiresAt: "2026-10-10" }]);

    await waitFor(() => {
      expect(screen.getByText("Clase disponible")).toBeTruthy();
    });

    expect(document.querySelector('[data-carousel="true"]')).toBeNull();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("en Mis compras muestra un CTA Comprar arriba a la derecha", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("4")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Compras" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mis compras" })).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: "Comprar paquetes" })).toBeTruthy();
  });
});
