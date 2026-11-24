import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassRating, GafaClient, UserReservation } from "../client/types";
import { PostClassRatingPrompt } from "./PostClassRatingPrompt";
import { parseClassRatings } from "./classRatings";

afterEach(() => cleanup());
beforeEach(() => sessionStorage.clear());

const history: UserReservation[] = [
  {
    id: 7,
    serviceName: "Fuerza",
    startsAt: "2026-01-02T12:00:00.000Z",
    locationName: "Lomas",
    staffName: "ISA",
    brandSlug: "fitspin",
    meetingId: 700,
    staffId: 4,
    isWaitlist: false,
    isOverbooking: false,
  },
];

function renderPrompt(client: GafaClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PostClassRatingPrompt
        client={client}
        companyId={1}
        history={history}
        config={parseClassRatings({ enabled: true, promptAfterClass: true })!}
        loading={false}
      />
    </QueryClientProvider>,
  );
}

const client = (submit = vi.fn(async (p) => p as ClassRating)) =>
  ({ getReservationRating: async () => null, submitReservationRating: submit }) as unknown as GafaClient;

describe("aviso “Tu última clase”", () => {
  it("es un aviso compacto con botón Calificar: no muestra el formulario abierto", async () => {
    renderPrompt(client());
    expect(await screen.findByText("Tu última clase")).toBeTruthy();
    expect(screen.getByText("Fuerza con ISA")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Calificar/ })).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Calificar abre el mismo popup y, al enviar, el aviso desaparece", async () => {
    const submit = vi.fn(async (p) => p as ClassRating);
    renderPrompt(client(submit));
    fireEvent.click(await screen.findByRole("button", { name: /Calificar/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para La clase" }));
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para ISA" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("Tu última clase")).toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("“Ahora no” (X) oculta el aviso y no vuelve en la sesión", async () => {
    const view = renderPrompt(client());
    fireEvent.click(await screen.findByRole("button", { name: "Ahora no" }));
    expect(screen.queryByText("Tu última clase")).toBeNull();
    view.unmount();
    renderPrompt(client());
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText("Tu última clase")).toBeNull();
  });
});
