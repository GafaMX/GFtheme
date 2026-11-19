import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClassRating, GafaClient, UserReservation } from "../client/types";
import { parseClassRatings } from "./classRatings";
import { ClassRatingForm } from "./ClassRatingForm";

afterEach(() => cleanup());

const reservation: UserReservation = {
  id: 44,
  serviceName: "Bici AM",
  startsAt: "2026-01-01T12:00:00.000Z",
  locationName: "Lomas",
  staffName: "ISA",
  brandSlug: "fitspin",
  meetingId: 900,
  staffId: 12,
  isWaitlist: false,
  isOverbooking: false,
};

function renderForm(client: GafaClient, config = parseClassRatings(true)!) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClassRatingForm client={client} reservation={reservation} config={config} />
    </QueryClientProvider>,
  );
}

function mockClient(overrides: Partial<GafaClient> = {}): GafaClient {
  return {
    getProfile: async () => ({ id: 1, name: "Ana", email: "ana@buq.mx" }),
    listBrands: async () => [],
    listLocations: async () => [],
    listServices: async () => [],
    listStaff: async () => [],
    listCombos: async () => [],
    listMemberships: async () => [],
    listMeetings: async () => [],
    listRegistrationFields: async () => [],
    listUserCredits: async () => [],
    listUserMemberships: async () => [],
    listUserReservations: async () => [],
    listUserPurchases: async () => [],
    cancelReservation: async () => undefined,
    logout: () => undefined,
    login: async () => ({ access_token: "x" }),
    register: async () => ({}),
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
    openCheckout: async () => undefined,
    openReservationCheckout: async () => undefined,
    getReservationRating: async () => null,
    submitReservationRating: async () => ({ reservationId: 44, classStars: 5, staffStars: 4 }),
    ...overrides,
  } as GafaClient;
}

describe("ClassRatingForm", () => {
  it("no pinta nada si la clase está cancelada", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ClassRatingForm
          client={mockClient()}
          reservation={{ ...reservation, cancelled: true }}
          config={parseClassRatings(true)!}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByLabelText("Calificar clase")).toBeNull();
  });

  it("envía una sola calificación de clase y coach", async () => {
    const submit = vi.fn(async (payload) => payload as ClassRating);
    renderForm(mockClient({ submitReservationRating: submit }));

    await waitFor(() => expect(screen.getByText("¿Qué tal estuvo?")).toBeTruthy());
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para La clase" }));
    fireEvent.click(screen.getByRole("radio", { name: "4 estrellas para ISA" }));
    fireEvent.change(screen.getByPlaceholderText("¿Algo que el estudio debería saber?"), {
      target: { value: "Excelente ritmo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith({
      brandSlug: "fitspin",
      reservationId: 44,
      meetingId: 900,
      staffId: 12,
      classStars: 5,
      staffStars: 4,
      comment: "Excelente ritmo",
    });
    await waitFor(() => expect(screen.getByText("Gracias por tu calificación")).toBeTruthy());
  });

  it("estado de error con reintento", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("No pudimos guardar tu calificación. Inténtalo de nuevo."))
      .mockResolvedValueOnce({ reservationId: 44, classStars: 5, staffStars: 5 });
    renderForm(mockClient({ submitReservationRating: submit }));
    await waitFor(() => expect(screen.getByText("¿Qué tal estuvo?")).toBeTruthy());
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para La clase" }));
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para ISA" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.getByText("Gracias por tu calificación")).toBeTruthy());
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("si ya hay calificación, queda solo lectura", async () => {
    renderForm(
      mockClient({
        getReservationRating: async () => ({
          reservationId: 44,
          classStars: 4,
          staffStars: 5,
          comment: "Top",
        }),
      }),
    );
    await waitFor(() => expect(screen.getByText("Gracias por tu calificación")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Enviar" })).toBeNull();
    expect(screen.getByText("Top")).toBeTruthy();
    expect((screen.getByRole("radio", { name: "4 estrellas para La clase" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
