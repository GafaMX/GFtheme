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

function renderForm(
  client: GafaClient,
  config = parseClassRatings(true)!,
  extra: Partial<React.ComponentProps<typeof ClassRatingForm>> = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClassRatingForm client={client} reservation={reservation} config={config} {...extra} />
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

describe("ClassRatingForm (cuerpo del popup)", () => {
  it("envía una sola calificación de clase y coach", async () => {
    const submit = vi.fn(async (payload) => payload as ClassRating);
    const onSubmitted = vi.fn();
    renderForm(mockClient({ submitReservationRating: submit }), undefined, { onSubmitted });

    expect(screen.getByText("¿Qué tal estuvo?")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para la clase" }));
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
      meetingName: "Bici AM",
      staffId: 12,
      staffName: "ISA",
      classStars: 5,
      staffStars: 4,
      comment: "Excelente ritmo",
    });
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
  });

  it("Enviar queda apagado hasta elegir las dos calificaciones", () => {
    renderForm(mockClient());
    const send = screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para la clase" }));
    expect(send.disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "3 estrellas para ISA" }));
    expect(send.disabled).toBe(false);
  });

  it("estado de error en español con reintento", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("No pudimos guardar tu calificación. Inténtalo de nuevo."))
      .mockResolvedValueOnce({ reservationId: 44, classStars: 5, staffStars: 5 });
    const onSubmitted = vi.fn();
    renderForm(mockClient({ submitReservationRating: submit }), undefined, { onSubmitted });
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para la clase" }));
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para ISA" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("No pudimos guardar"));
    expect(onSubmitted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("Cancelar avisa sin enviar nada", () => {
    const submit = vi.fn();
    const onCancel = vi.fn();
    renderForm(mockClient({ submitReservationRating: submit }), undefined, { onCancel });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it("solo coach: pide una sola calificación", async () => {
    const submit = vi.fn(async (payload) => payload as ClassRating);
    renderForm(mockClient({ submitReservationRating: submit }), parseClassRatings({ enabled: true, rateClass: false })!);
    expect(screen.queryByRole("radio", { name: /para la clase/ })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "4 estrellas para ISA" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0]![0]).toMatchObject({ classStars: null, staffStars: 4 });
  });
});
