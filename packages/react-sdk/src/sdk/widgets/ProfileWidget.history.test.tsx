import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { GafaClient, UserProfile, UserReservation } from "../client/types";
import { ACCOUNT_HISTORY_CHUNK } from "../account/accountHistory";
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
  email: "gabriel@buq.mx",
};

function pastClass(id: number): UserReservation {
  return {
    id,
    serviceName: `Clase ${id}`,
    startsAt: `2026-01-${String(id).padStart(2, "0")}T12:00:00.000Z`,
    locationName: "Lomas",
    brandSlug: "fitspin",
  };
}

function mockClient(past: UserReservation[]): GafaClient {
  return {
    getProfile: async () => profile,
    listBrands: async () => [{ id: 80, name: "Fitspin", slug: "fitspin" }],
    listUserCredits: async () => [],
    listUserMemberships: async () => [],
    listUserReservations: async (_slug, when) => (when === "past" ? past : []),
    listUserPurchases: async () => [],
    listLocations: async () => [],
    listServices: async () => [],
    listStaff: async () => [],
    listCombos: async () => [],
    listMemberships: async () => [],
    listMeetings: async () => [],
    listRegistrationFields: async () => [],
    cancelReservation: async () => undefined,
    logout: () => undefined,
  } as GafaClient;
}

function renderProfile(past: UserReservation[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileWidget client={mockClient(past)} brandSlug="fitspin" />
    </QueryClientProvider>,
  );
}

describe("perfil: historial paginado", () => {
  it("en Historial muestra un lote y Ver más el resto", async () => {
    const past = Array.from({ length: ACCOUNT_HISTORY_CHUNK + 6 }, (_, i) => pastClass(i + 1));
    renderProfile(past);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Mis clases" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Mis clases" }));
    fireEvent.click(await screen.findByRole("tab", { name: "Historial" }));

    await waitFor(() => {
      expect(screen.getByText("Clase 16")).toBeTruthy();
    });
    expect(screen.getByText("Clase 7")).toBeTruthy();
    expect(screen.queryByText("Clase 6")).toBeNull();
    expect(screen.getByRole("button", { name: /ver más \(6\)/i })).toBeTruthy();
    expect(document.querySelector(".gafa-acct-group__count")?.textContent).toBe("16");

    fireEvent.click(screen.getByRole("button", { name: /ver más/i }));
    expect(screen.getByText("Clase 6")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /ver más/i })).toBeNull();
  });

  it("si caben en un lote, no muestra Ver más", async () => {
    const past = Array.from({ length: 8 }, (_, i) => pastClass(i + 1));
    renderProfile(past);

    fireEvent.click(await screen.findByRole("button", { name: "Mis clases" }));
    fireEvent.click(await screen.findByRole("tab", { name: "Historial" }));

    await waitFor(() => {
      expect(screen.getByText("Clase 8")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /ver más/i })).toBeNull();
    expect(document.querySelector(".gafa-acct-group__count")?.textContent).toBe("8");
  });
});
