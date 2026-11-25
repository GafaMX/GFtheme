import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ClassRating, GafaClient, UserProfile, UserReservation } from "../client/types";
import { parseClassRatings } from "../ratings/classRatings";
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

function pastClass(id: number, extra: Partial<UserReservation> = {}): UserReservation {
  return {
    id,
    serviceName: `Clase ${id}`,
    startsAt: `2026-01-${String(id).padStart(2, "0")}T12:00:00.000Z`,
    locationName: "Lomas",
    staffName: "ISA",
    brandSlug: "fitspin",
    meetingId: 800 + id,
    staffId: 12,
    isWaitlist: false,
    isOverbooking: false,
    ...extra,
  };
}

function mockClient(past: UserReservation[], ratings = new Map<number, ClassRating>()): GafaClient {
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
    getReservationRating: async (_slug, id) => ratings.get(Number(id)) ?? null,
    submitReservationRating: async (payload) => {
      const saved: ClassRating = {
        reservationId: payload.reservationId,
        classStars: payload.classStars,
        staffStars: payload.staffStars,
        comment: payload.comment ?? null,
      };
      ratings.set(payload.reservationId, saved);
      return saved;
    },
  } as GafaClient;
}

function renderProfile(past: UserReservation[], classRatings = parseClassRatings(true), client = mockClient(past)) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileWidget client={client} brandSlug="fitspin" classRatings={classRatings} />
    </QueryClientProvider>,
  );
}

async function openHistory() {
  fireEvent.click(await screen.findByRole("button", { name: "Mis clases" }));
  fireEvent.click(await screen.findByRole("tab", { name: "Historial" }));
}

describe("perfil: calificar historial", () => {
  it("apagado por default: no hay UI de estrellas", async () => {
    renderProfile([pastClass(8)], null);
    await openHistory();
    await waitFor(() => expect(screen.getByText("Clase 8")).toBeTruthy());
    expect(screen.queryByLabelText("Calificar clase")).toBeNull();
  });

  it("con el flag, la tarjeta solo trae el botón Calificar y el formulario va en el popup", async () => {
    renderProfile([pastClass(8)]);
    await openHistory();
    const button = await screen.findByRole("button", { name: /^Calificar/ });
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByText("¿Qué tal estuvo?")).toBeNull();
    const card = button.closest("article");
    expect(card?.querySelector(".gafa-acct-class__actions")?.contains(button)).toBe(true);
    expect(card?.querySelector(".gafa-acct-class__info")?.contains(button)).toBe(false);
    fireEvent.click(button);
    expect(await screen.findByRole("dialog", { name: /Calificar clase/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para La clase" }));
    fireEvent.click(screen.getByRole("radio", { name: "4 estrellas para ISA" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.getByText("Calificada ★ 5")).toBeTruthy());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("una clase ya calificada queda en una línea corta", async () => {
    const ratings = new Map<number, ClassRating>([[8, { reservationId: 8, classStars: 5, staffStars: 5, comment: "Top" }]]);
    renderProfile([pastClass(8)], parseClassRatings(true), mockClient([pastClass(8)], ratings));
    await openHistory();
    await waitFor(() => expect(screen.getByText("Calificada ★ 5")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /^Calificar/ })).toBeNull();
    expect(screen.queryByText("Top")).toBeNull();
  });

  it("cancelada o waitlist no se califican", async () => {
    renderProfile([pastClass(8, { cancelled: true }), pastClass(9, { isWaitlist: true })]);
    await openHistory();
    await waitFor(() => expect(screen.getByText("Clase 8")).toBeTruthy());
    expect(screen.queryByLabelText("Calificar clase")).toBeNull();
  });
});
