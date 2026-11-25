import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassRating, GafaClient, UserReservation } from "../client/types";
import { PostClassRatingPrompt } from "./PostClassRatingPrompt";
import { parseClassRatings, ratingPromptStorageKey } from "./classRatings";

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

function PromptWithHeading({ client }: { client: GafaClient }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  return (
    <>
      <h2 ref={headingRef} tabIndex={-1}>Mi cuenta</h2>
      <PostClassRatingPrompt
        client={client}
        companyId={1}
        history={history}
        config={parseClassRatings({ enabled: true, promptAfterClass: true })!}
        loading={false}
        onDismissFocus={() => headingRef.current?.focus()}
      />
    </>
  );
}

function renderPrompt(client: GafaClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PromptWithHeading client={client} />
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

  it("al enviar enfoca la confirmación y al cerrarla lleva el foco al encabezado", async () => {
    const submit = vi.fn(async (p) => p as ClassRating);
    renderPrompt(client(submit));
    fireEvent.click(await screen.findByRole("button", { name: /Calificar/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para la clase" }));
    fireEvent.click(screen.getByRole("radio", { name: "4 estrellas para ISA" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const confirmation = await screen.findByRole("status");
    expect(confirmation.textContent).toBe("¡Gracias! Calificaste Fuerza ★ 5");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(confirmation);
    expect(sessionStorage.getItem(ratingPromptStorageKey(1, 7))).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar confirmación" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Mi cuenta" }));
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
