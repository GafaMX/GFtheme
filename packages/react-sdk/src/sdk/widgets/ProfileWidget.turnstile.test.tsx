import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { GafaClient, UserMembership, UserProfile, UserReservation } from "../client/types";
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

const membership: UserMembership = {
  id: 9,
  name: "Mensual The Base",
  expiresAt: "2099-12-01",
};

function mockClient(
  profile: UserProfile,
  reservations: UserReservation[] = [],
  memberships: UserMembership[] = [],
): GafaClient {
  return {
    getProfile: async () => profile,
    listBrands: async () => [{ id: 225, name: "The Base", slug: "the-base" }],
    listUserCredits: async () => [],
    listUserMemberships: async () => memberships,
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

function renderProfile(
  profile: UserProfile,
  reservations: UserReservation[] = [],
  memberships: UserMembership[] = [],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileWidget client={mockClient(profile, reservations, memberships)} brandSlug="the-base" />
    </QueryClientProvider>,
  );
}

describe("perfil: QR de torniquete", () => {
  it("no inventa una card nueva en Mi actividad", async () => {
    renderProfile({
      id: 1,
      name: "Ana Ruiz",
      firstName: "Ana",
      email: "ana@thebase.mx",
      turnstileCardNo: "1234567",
    });

    await waitFor(() => {
      expect(screen.getByText("Sin clases reservadas")).toBeTruthy();
    });

    expect(screen.queryByLabelText("Tu código de acceso")).toBeNull();
    expect(screen.queryByText("Tu QR de acceso")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver mi QR" })).toBeNull();
  });

  it("con membresía y sin reserva, Ver mi QR abre el modal existente", async () => {
    renderProfile(
      {
        id: 1,
        name: "Ana Ruiz",
        firstName: "Ana",
        email: "ana@thebase.mx",
        turnstileCardNo: "1234567",
      },
      [],
      [membership],
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ver mi QR" }));

    expect(screen.getByRole("dialog", { name: "Código QR de tu clase" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Código QR de la reserva" }).tagName).toBe("svg");
    expect(screen.getByText("1234567")).toBeTruthy();
    expect(document.body.innerHTML).not.toMatch(/qrserver\.com/i);
    expect(screen.queryByLabelText("Tu código de acceso")).toBeNull();
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

    expect(screen.getByRole("img", { name: "Código QR de la reserva" }).tagName).toBe("svg");
    expect(document.body.innerHTML).not.toMatch(/qrserver\.com/i);
    expect(document.body.innerHTML).not.toContain("hash-de-clase");
    expect(screen.getByText("87654321")).toBeTruthy();
  });

  it("muestra Ver mi QR si hay turnstile_card_no aunque la reserva no tenga hash", async () => {
    const withoutHash = { ...reservation, qrHash: undefined };
    renderProfile(
      {
        id: 1,
        name: "Ana Ruiz",
        firstName: "Ana",
        email: "ana@thebase.mx",
        turnstileCardNo: "1234567",
      },
      [withoutHash],
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ver mi QR" }));
    expect(screen.getByRole("img", { name: "Código QR de la reserva" }).tagName).toBe("svg");
    expect(document.body.innerHTML).not.toMatch(/qrserver\.com/i);
  });

  it("en Mis clases también muestra Ver QR sin hash_qr si hay torniquete", async () => {
    const withoutHash = { ...reservation, qrHash: undefined };
    renderProfile(
      {
        id: 1,
        name: "Ana Ruiz",
        firstName: "Ana",
        email: "ana@thebase.mx",
        turnstileCardNo: "1234567",
      },
      [withoutHash],
    );

    fireEvent.click(await screen.findByRole("button", { name: "Mis clases" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver QR" }));
    expect(screen.getByRole("img", { name: "Código QR de la reserva" }).tagName).toBe("svg");
    expect(document.body.innerHTML).not.toMatch(/qrserver\.com/i);
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
