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

const reservation: UserReservation = {
  id: 44,
  serviceName: "Open Gym",
  startsAt: "2099-10-21T16:00:00.000Z",
  locationName: "The Base",
  staffName: "Coach",
  brandSlug: "the-base",
  isWaitlist: false,
  isOverbooking: false,
  qrHash: "hash-de-clase",
  canCancel: true,
};

function mockClient(profile: UserProfile, reservations: UserReservation[] = []): GafaClient {
  return {
    getProfile: async () => profile,
    listBrands: async () => [{ id: 225, name: "The Base", slug: "the-base" }],
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

function renderProfile(profile: UserProfile, reservations: UserReservation[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileWidget client={mockClient(profile, reservations)} brandSlug="the-base" />
    </QueryClientProvider>,
  );
}

describe("perfil: QR de torniquete", () => {
  it("pinta el QR y el número cuando turnstile_card_no viene en el perfil", async () => {
    renderProfile({
      id: 1,
      name: "Ana Ruiz",
      firstName: "Ana",
      email: "ana@thebase.mx",
      turnstileCardNo: "1234567",
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Tu código de acceso")).toBeTruthy();
    });

    expect(screen.getByText("1234567")).toBeTruthy();
    const image = screen.getByAltText("Código QR de acceso") as HTMLImageElement;
    expect(image.src).toContain(encodeURIComponent("1234567"));
    expect(image.src).not.toContain(encodeURIComponent("hash-de-clase"));
  });

  it("no cambia nada si el campo falta o es null", async () => {
    renderProfile({
      id: 1,
      name: "Ana Ruiz",
      firstName: "Ana",
      email: "ana@fitspin.mx",
      turnstileCardNo: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Sin clases reservadas")).toBeTruthy();
    });

    expect(screen.queryByLabelText("Tu código de acceso")).toBeNull();
    expect(screen.queryByAltText("Código QR de acceso")).toBeNull();
  });

  it("el QR de la reserva usa el número de torniquete, no el hash", async () => {
    renderProfile(
      {
        id: 1,
        name: "Ana Ruiz",
        firstName: "Ana",
        email: "ana@thebase.mx",
        turnstileCardNo: "87654321",
      },
      [reservation],
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ver mi QR" }));

    const image = (await screen.findByAltText("Código QR de la reserva")) as HTMLImageElement;
    expect(image.src).toContain(encodeURIComponent("87654321"));
    expect(image.src).not.toContain(encodeURIComponent("hash-de-clase"));
    expect(screen.getAllByText("87654321").length).toBeGreaterThan(0);
  });

  it("sin turnstile_card_no el QR de la reserva sigue usando el hash", async () => {
    renderProfile(
      {
        id: 1,
        name: "Ana Ruiz",
        firstName: "Ana",
        email: "ana@fitspin.mx",
      },
      [reservation],
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ver mi QR" }));

    const image = (await screen.findByAltText("Código QR de la reserva")) as HTMLImageElement;
    expect(image.src).toContain(encodeURIComponent("hash-de-clase"));
    expect(screen.queryByText("hash-de-clase")).toBeNull();
  });
});
