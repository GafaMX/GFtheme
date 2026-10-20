import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { GafaClient, UserProfile, UserReservation } from "../client/types";
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

const profile: UserProfile = {
  id: 1,
  name: "Gabriel Arrechea",
  firstName: "Gabriel",
  lastName: "Arrechea",
  email: "gabriel+fitspin@buq.mx",
  storeCreditTotal: "0",
};

const waitlistItem: UserReservation = {
  id: 901,
  serviceName: "Ride 45",
  startsAt: "2099-08-26T16:00:00.000Z",
  locationName: "Voltio",
  staffName: "Coach Ana",
  brandSlug: "masvoltio",
  isWaitlist: true,
  isOverbooking: false,
  waitlistPosition: "2",
  canCancel: true,
};

function mockClient(reservations: UserReservation[]): GafaClient {
  return {
    getProfile: async () => profile,
    listBrands: async () => [{ id: 84, name: "Voltio", slug: "masvoltio" }],
    listUserCredits: async () => [],
    listUserMemberships: async () => [],
    listUserReservations: async () => reservations,
    listUserPurchases: async () => [],
    listLocations: async () => [],
    listServices: async () => [],
    listStaff: async () => [],
    listCombos: async () => [],
    listMemberships: async () => [],
    listMeetings: async () => [],
    listRegistrationFields: async () => [],
    cancelReservation: async () => undefined,
    cancelWaitlist: async () => undefined,
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

function renderProfile(reservations: UserReservation[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileWidget client={mockClient(reservations)} brandSlug="masvoltio" />
    </QueryClientProvider>,
  );
}

describe("perfil: waitlist en Mi cuenta", () => {
  it("en Mi actividad muestra la clase en espera, no el vacio de reservas", async () => {
    renderProfile([waitlistItem]);

    await waitFor(() => {
      expect(screen.getByText("En lista de espera")).toBeTruthy();
    });

    expect(screen.getByRole("heading", { name: "Ride 45" })).toBeTruthy();
    expect(screen.getByText(/En espera · lugar 2/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salir" })).toBeTruthy();
    expect(screen.queryByText("Sin clases reservadas")).toBeNull();
    expect(screen.getByText(/1 en lista de espera/)).toBeTruthy();
  });

  it("en Mis clases lista la espera con chip y Salir", async () => {
    renderProfile([waitlistItem]);

    await waitFor(() => {
      expect(screen.getByText("Ride 45")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Mis clases" }));

    await waitFor(() => {
      expect(screen.getByText("Lista de espera")).toBeTruthy();
    });

    const card = document.querySelector('[data-waitlist="true"]');
    expect(card?.textContent).toMatch(/Ride 45/);
    expect(card?.textContent).toMatch(/En espera · lugar 2/);
    expect(screen.getByRole("button", { name: "Salir" })).toBeTruthy();
  });
});
