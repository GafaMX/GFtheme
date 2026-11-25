import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClassRating, GafaClient, UserReservation } from "../client/types";
import { ClassRatingAction, ratedSummary } from "./ClassRatingAction";
import { parseClassRatings } from "./classRatings";

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

function mockClient(overrides: Partial<GafaClient> = {}): GafaClient {
  return {
    getReservationRating: async () => null,
    submitReservationRating: async () => ({ reservationId: 44, classStars: 5, staffStars: 4 }),
    ...overrides,
  } as unknown as GafaClient;
}

function renderAction(client: GafaClient, res: UserReservation = reservation) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClassRatingAction client={client} reservation={res} config={parseClassRatings(true)!} />
    </QueryClientProvider>,
  );
}

async function findCalificar() {
  return (await screen.findByRole("button", { name: /^Calificar/ })) as HTMLButtonElement;
}

describe("ClassRatingAction (tarjeta de la clase)", () => {
  it("en la tarjeta solo hay un botón “Calificar”, sin estrellas ni formulario", async () => {
    renderAction(mockClient());
    const button = await findCalificar();
    expect(button.textContent).toContain("Calificar");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByPlaceholderText("¿Algo que el estudio debería saber?")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("el botón abre el popup con estrellas de clase y coach, comentario, Enviar y Cancelar", async () => {
    renderAction(mockClient());
    fireEvent.click(await findCalificar());
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("Bici AM");
    expect(dialog.textContent).toContain("ISA");
    expect(screen.getAllByRole("radio")).toHaveLength(10);
    expect(screen.getByPlaceholderText("¿Algo que el estudio debería saber?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeTruthy();
  });

  it("el foco entra al popup y Escape lo cierra devolviendo el foco al botón", async () => {
    renderAction(mockClient());
    const button = await findCalificar();
    button.focus();
    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it("Escape no se filtra a otros popups de abajo", async () => {
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    renderAction(mockClient());
    fireEvent.click(await findCalificar());
    await screen.findByRole("dialog");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(outer).not.toHaveBeenCalled();
    document.removeEventListener("keydown", outer);
  });

  it("se cierra con la X, con Cancelar y tocando fuera", async () => {
    renderAction(mockClient());
    const button = await findCalificar();

    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog");
    fireEvent.mouseDown(dialog); // dentro: no cierra
    expect(screen.queryByRole("dialog")).toBeTruthy();
    fireEvent.mouseDown(dialog.parentElement!); // fondo
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("atrapa el foco: Tab desde el último vuelve al primero y Shift+Tab al revés", async () => {
    renderAction(mockClient());
    fireEvent.click(await findCalificar());
    const dialog = await screen.findByRole("dialog");
    const close = screen.getByRole("button", { name: "Cerrar" });
    // En jsdom no hay layout: offsetParent es null, así que se fuerza visible.
    dialog.querySelectorAll("button, textarea").forEach((el) => {
      Object.defineProperty(el, "offsetParent", { configurable: true, get: () => document.body });
    });
    const send = screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement;
    // Enviar sigue apagado hasta elegir estrellas: el último foco posible es Cancelar.
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    cancel.focus();
    expect(send.disabled).toBe(true);
    fireEvent.keyDown(cancel, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });

  it("deja una parada de Tab por fila y las flechas mueven el foco y seleccionan la estrella", async () => {
    renderAction(mockClient());
    fireEvent.click(await findCalificar());
    const tabStops = () => screen.getAllByRole("radio").filter((radio) => radio.tabIndex === 0);
    const first = screen.getByRole("radio", { name: "1 estrella para la clase" });
    const second = screen.getByRole("radio", { name: "2 estrellas para la clase" });
    const firstCoach = screen.getByRole("radio", { name: "1 estrella para ISA" });
    expect(tabStops()).toEqual([first, firstCoach]);

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("aria-checked")).toBe("true");
    expect(first.getAttribute("aria-checked")).toBe("false");
    expect(tabStops()).toEqual([second, firstCoach]);

    fireEvent.keyDown(second, { key: "End" });
    const last = screen.getByRole("radio", { name: "5 estrellas para la clase" });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Home" });
    expect(document.activeElement).toBe(first);
    expect(first.getAttribute("aria-checked")).toBe("true");
  });

  it("al enviar, cierra el popup y la tarjeta queda con “Calificada ★ 5”", async () => {
    const submit = vi.fn(async (payload) => payload as ClassRating);
    renderAction(mockClient({ submitReservationRating: submit }));
    fireEvent.click(await findCalificar());
    fireEvent.click(await screen.findByRole("radio", { name: "5 estrellas para la clase" }));
    fireEvent.click(screen.getByRole("radio", { name: "4 estrellas para ISA" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const done = await screen.findByRole("status");
    expect(done.querySelector('[aria-hidden="true"]')?.textContent).toBe("Calificada ★ 5");
    expect(done.querySelector(".gafa-sr-only")?.textContent).toBe("Calificada: clase 5 de 5, coach 4 de 5");
    expect(done.getAttribute("title")).toBe("Calificada: clase 5 de 5, coach 4 de 5");
    expect(done.hasAttribute("aria-label")).toBe(false);
    expect(screen.queryByRole("button", { name: /^Calificar/ })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(done));
    fireEvent.blur(done);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("si el envío falla, el popup sigue abierto con el error en español", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("El estudio aún no puede guardar calificaciones."));
    renderAction(mockClient({ submitReservationRating: submit }));
    fireEvent.click(await findCalificar());
    fireEvent.click(await screen.findByRole("radio", { name: "5 estrellas para la clase" }));
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas para ISA" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("El estudio aún no puede guardar calificaciones.");
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("clase ya calificada: línea corta, sin botón ni bloque grande", async () => {
    renderAction(
      mockClient({ getReservationRating: async () => ({ reservationId: 44, classStars: 5, staffStars: 4, comment: "Top" }) }),
    );
    const visible = await screen.findByText("Calificada ★ 5");
    expect(visible.parentElement?.getAttribute("title")).toBe("Calificada: clase 5 de 5, coach 4 de 5");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Calificar/ })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByText("Top")).toBeNull();
  });

  it("cancelada o waitlist: no pinta nada", () => {
    const { container } = renderAction(mockClient(), { ...reservation, cancelled: true });
    expect(container.textContent).toBe("");
    cleanup();
    const second = renderAction(mockClient(), { ...reservation, isWaitlist: true });
    expect(second.container.textContent).toBe("");
  });
});

describe("ratedSummary", () => {
  const both = parseClassRatings(true)!;
  it("mantiene una línea corta y prepara el detalle para el tooltip y el lector de pantalla", () => {
    expect(ratedSummary({ reservationId: 1, classStars: 5, staffStars: 5 }, both).text).toBe("Calificada ★ 5");
    const mixed = ratedSummary({ reservationId: 1, classStars: 5, staffStars: 4 }, both);
    expect(mixed.text).toBe("Calificada ★ 5");
    expect(mixed.label).toContain("clase 5 de 5");
    expect(mixed.label).toContain("coach 4 de 5");
  });
  it("solo coach", () => {
    const coachOnly = parseClassRatings({ enabled: true, rateClass: false })!;
    expect(ratedSummary({ reservationId: 1, staffStars: 3 }, coachOnly).text).toBe("Calificada ★ 3");
  });
});
