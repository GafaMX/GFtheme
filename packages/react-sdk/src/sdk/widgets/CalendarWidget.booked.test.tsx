import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "../client/httpGafaClient";
import { clearStoredToken, writeStoredToken } from "../client/tokenStorage";
import type { GafaClient, Meeting, UserReservation } from "../client/types";
import { ToastHost } from "../toast/ToastHost";
import { clearToasts, getToasts } from "../toast/toastStore";
import { CalendarWidget } from "./CalendarWidget";

const now = new Date("2026-11-24T16:00:00Z");
const startsAt = "2026-11-24T21:00:00Z";
const brands = [
  { id: 1, name: "Fitspin CDMX", slug: "fitspin", timeZone: "America/Mexico_City" },
  { id: 2, name: "Fitspin Cancún", slug: "fitspin-cancun", timeZone: "America/Cancun" },
];
const location = { id: 2, name: "Cancún", slug: "cancun", brandSlug: brands[1].slug };
const meeting: Meeting = { id: 238, name: "Ride", brandSlug: brands[1].slug, startsAt, timezone: "America/Cancun", location, available: 1, capacity: 10 };

const four: UserReservation = {
  id: 4, meetingId: meeting.id, brandSlug: brands[1].slug, startsAt, serviceName: "Ride",
  seatLabel: "4", isWaitlist: false, isOverbooking: false, canCancel: true,
};
const seven: UserReservation = { ...four, id: 7, meetingId: undefined, seatLabel: "7" };

function setup(own: UserReservation[], { session = true, fallback = false, language, view, allowViewChange = false }: {
  session?: boolean; fallback?: boolean; language?: string; view?: "day" | "week"; allowViewChange?: boolean;
} = {}) {
  if (session) writeStoredToken("test-session");
  let reservations = [...own];
  const cancel = vi.fn(async (_brand: string, id: string | number) => {
    reservations = reservations.filter((row) => row.id !== id);
  });
  const listUserReservations = vi.fn(async (slug: string) => reservations.filter((row) => row.brandSlug === slug));
  const client = {
    listBrands: async () => brands,
    listLocations: async (slug: string) => slug === brands[1].slug ? [location] : [],
    listMeetings: async () => [{ ...meeting, isReserved: fallback || reservations.length > 0, available: 1 + own.length - reservations.length }],
    listUserReservations,
    cancelReservation: cancel,
  } as unknown as GafaClient;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CalendarWidget client={client} language={language} view={view} allowViewChange={allowViewChange} />
    </QueryClientProvider>,
  );
  return { client, cancel, listUserReservations, queryClient, remove: (id: number) => { reservations = reservations.filter((row) => row.id !== id); } };
}

function click(button: HTMLElement) {
  button.focus();
  fireEvent.click(button);
}

const sheet = () => screen.getByRole("dialog", { name: "Ride" });
const confirm = () => screen.getByRole("alertdialog");
const manage = () => screen.findByRole("button", { name: "Ver / cancelar tus lugares" });
const yes = () => within(confirm()).getByRole("button", { name: "Sí, cancelar" });

beforeEach(() => {
  vi.setSystemTime(now);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request")));
});

afterEach(() => {
  cleanup();
  clearStoredToken();
  clearToasts();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Reservado con Cancelar", () => {
  it("carga todas las marcas con sesión y cancela un lugar con el POST de V2", async () => {
    const otherHost = render(<ToastHost />);
    const vm = setup([four], { session: false });
    otherHost.unmount();
    const status = screen.getByRole("status");
    expect(await screen.findByText("Reservado")).toBeTruthy();
    expect(vm.listUserReservations).not.toHaveBeenCalled();
    const post = vi.fn(async () => {
      vm.remove(4);
      return Response.json({});
    });
    vi.stubGlobal("fetch", post);
    const http = createHttpGafaClient({ apiBaseUrl: "https://example.test", companyId: 80 });
    vm.client.cancelReservation = http.cancelReservation;

    act(() => writeStoredToken("test-session"));
    const pill = await screen.findByText("Reservado · Lugar 4");
    expect(pill.closest("article")?.dataset.booked).toBe("true");
    expect(vm.listUserReservations.mock.calls).toEqual([["fitspin", "future"], ["fitspin-cancun", "future"]]);
    click(screen.getByRole("button", { name: "Cancelar Lugar 4" }));
    expect(confirm().getAttribute("aria-label")).toBe("¿Cancelar Lugar 4?");
    expect(within(confirm()).getByText(/te regresamos la clase/)).toBeTruthy();
    click(yes());
    await waitFor(() => expect(status.textContent).toBe("Cancelamos tu reserva."));
    expect(getToasts()).toEqual([]);
    expect(post).toHaveBeenCalledExactlyOnceWith("https://example.test/api/me/brand/fitspin-cancun/reservation-future/4/cancel", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText("2/10 lugares")).toBeTruthy();
    expect(screen.queryByText("Reservado · Lugar 4")).toBeNull();
  });

  it("vacía la región de estado entre dos cancelaciones con el mismo resultado", async () => {
    const { cancel } = setup([four, seven, { ...four, id: 9, seatLabel: "9" }]);
    click(await manage());
    const dialog = within(sheet());
    const status = dialog.getByRole("status");
    expect(status.getAttribute("aria-atomic")).toBe("true");
    expect(status.textContent).toBe("");

    click(dialog.getByRole("button", { name: "Cancelar Lugar 4" }));
    click(yes());
    await waitFor(() => expect(status.textContent).toBe("Cancelamos tu reserva."));

    click(await dialog.findByRole("button", { name: "Cancelar Lugar 7" }));
    expect(dialog.getByRole("status")).toBe(status);
    expect(status.textContent).toBe("");
    click(yes());
    await waitFor(() => expect(status.textContent).toBe("Cancelamos tu reserva."));
    expect(dialog.getByRole("status")).toBe(status);
    expect(cancel.mock.calls.map(([, id]) => id)).toEqual([4, 7]);
  });

  it("limpia el aviso anterior al volver a abrir la hoja", async () => {
    setup([four, seven, { ...four, id: 9, seatLabel: "9" }]);
    click(await manage());
    const dialog = within(sheet());
    click(dialog.getByRole("button", { name: "Cancelar Lugar 4" }));
    click(yes());
    await dialog.findByText("Cancelamos tu reserva.");

    click(dialog.getByRole("button", { name: "Cerrar" }));
    const status = screen.getByRole("status", { name: "" });
    expect(status.textContent).toBe("Cancelamos tu reserva.");
    click(await manage());
    expect(status.textContent).toBe("");
    expect(within(sheet()).getByRole("status").textContent).toBe("");
    expect(screen.queryByText("Cancelamos tu reserva.")).toBeNull();
  });

  it.each([
    ["day", "Día siguiente"],
    ["week", "Semana siguiente"],
    ["day", "Semana"],
    ["week", "Día"],
  ] as const)("limpia el aviso en vista %s al pulsar %s", async (view, control) => {
    setup([four], { view, allowViewChange: true });
    const status = screen.getByRole("status", { name: "" });
    click(await screen.findByRole("button", { name: "Cancelar Lugar 4" }));
    click(yes());
    await waitFor(() => expect(status.textContent).toBe("Cancelamos tu reserva."));

    click(screen.getByRole("button", { name: control }));
    expect(status.textContent).toBe("");
  });

  it("abre la hoja con dos lugares y confirma los dos", async () => {
    const { cancel } = setup([seven, four]);
    const opener = await manage();
    expect(opener.textContent).toBe("Ver / cancelar");
    expect(screen.getByText("Reservado · 2 lugares (4, 7)")).toBeTruthy();
    click(opener);
    expect(within(sheet()).getByText("Tus lugares")).toBeTruthy();
    expect(within(sheet()).getAllByRole("listitem")).toHaveLength(2);
    expect(within(sheet()).getByText(/24 de noviembre.*04:00/)).toBeTruthy();
    click(within(sheet()).getByRole("button", { name: "Cancelar los 2 lugares" }));
    expect(confirm().getAttribute("aria-label")).toBe("¿Cancelar tus 2 lugares?");
    expect(within(confirm()).getByText("Se cancelarán los lugares 4 y 7")).toBeTruthy();
    click(yes());
    await screen.findByText("Cancelamos tus reservas.");
    expect(cancel.mock.calls).toEqual([["fitspin-cancun", 4], ["fitspin-cancun", 7]]);
  });

  it("cancela todos los lugares elegibles y conserva la explicación de los vencidos", async () => {
    const { cancel } = setup([{ ...four, canCancel: false }, seven, { ...four, id: 9, seatLabel: "9" }]);
    click(await manage());

    const dialog = within(sheet());
    const eligible = dialog.getByRole<HTMLButtonElement>("button", {
      name: "Cancelar los 2 lugares disponibles",
      description: "El plazo de cancelación ya venció para Lugar 4.",
    });
    expect(eligible.disabled).toBe(false);
    click(eligible);
    expect(within(confirm()).getByText("Se cancelarán los lugares 7 y 9")).toBeTruthy();
    click(yes());

    const result = "Cancelamos tus reservas. El plazo de cancelación ya venció para Lugar 4.";
    await waitFor(() => expect(dialog.getByRole("status").textContent).toBe(result));
    expect(cancel.mock.calls).toEqual([["fitspin-cancun", 7], ["fitspin-cancun", 9]]);
    expect(dialog.getAllByRole("listitem").map((row) => within(row).getByText("Lugar 4").textContent)).toEqual(["Lugar 4"]);
    click(dialog.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("status").textContent).toBe(result);
    expect(screen.getByText("Reservado · Lugar 4")).toBeTruthy();
  });

  it("vuelve a pedir confirmación para los lugares elegibles si uno vence en el diálogo", async () => {
    const { cancel } = setup([{ ...four, cancelableUntil: "2026-11-24T16:01:00Z" }, seven]);
    click(await manage());
    click(within(sheet()).getByRole("button", { name: "Cancelar los 2 lugares" }));
    expect(confirm().getAttribute("aria-label")).toBe("¿Cancelar tus 2 lugares?");

    vi.setSystemTime(new Date("2026-11-24T16:02:00Z"));
    click(yes());
    expect(cancel).not.toHaveBeenCalled();
    expect(confirm().getAttribute("aria-label")).toBe("¿Cancelar Lugar 7?");
    expect(within(confirm()).getByText(/El plazo de cancelación ya venció para Lugar 4/)).toBeTruthy();
    click(yes());
    await waitFor(() => expect(within(sheet()).getByRole("status").textContent)
      .toBe("Cancelamos tu reserva. El plazo de cancelación ya venció para Lugar 4."));
    expect(cancel).toHaveBeenCalledExactlyOnceWith("fitspin-cancun", 7);
  });

  it.each([
    ["en", "View / cancel your spots", "View / cancel", "Cancel the available spot", "The cancellation window has closed for Spot 4."],
    ["fr", "Voir / annuler vos places", "Voir / annuler", "Annuler la place disponible", "Le délai d’annulation est dépassé pour Place 4."],
  ])("localiza la acción y el motivo de la hoja mixta en %s", async (language, opener, label, name, description) => {
    setup([{ ...four, canCancel: false }, seven], { language });
    const manageButton = await screen.findByRole("button", { name: opener });
    expect(manageButton.textContent).toBe(label);
    click(manageButton);
    expect(within(sheet()).getByRole("button", { name, description })).toBeTruthy();
  });

  it("mantiene los botones vencidos en el recorrido de foco con el motivo accesible", async () => {
    const { cancel } = setup([{ ...four, canCancel: false }, { ...seven, canCancel: false }]);
    click(await manage());
    const dialog = within(sheet());
    const close = dialog.getByRole("button", { name: "Cerrar" });
    const all = dialog.getByRole<HTMLButtonElement>("button", {
      name: "Cancelar los 2 lugares", description: "Ya pasó el tiempo para cancelar",
    });
    expect(all.disabled).toBe(false);
    expect(all.getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(all);
    fireEvent.click(all);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(cancel).not.toHaveBeenCalled();
    const spot = dialog.getByRole<HTMLButtonElement>("button", {
      name: "Cancelar Lugar 4", description: "Ya pasó el tiempo para cancelar",
    });
    act(() => spot.focus());
    expect(document.activeElement).toBe(spot);
    expect(spot.getAttribute("aria-disabled")).toBe("true");
    expect(spot.disabled).toBe(false);
  });

  it("reposiciona el tooltip de semana dentro de la pantalla de 390 px", async () => {
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    setup([{ ...four, canCancel: false }], { language: "en", view: "week" });
    const button = await screen.findByRole("button", { name: "Cancel Spot 4" });
    const week = button.closest(".gafa-week-grid");
    expect(week).toBeTruthy();
    let buttonLeft = 340;
    let buttonTop = 100;
    vi.spyOn(button, "getBoundingClientRect").mockImplementation(() => new DOMRect(buttonLeft, buttonTop, 46, 28));
    const measure = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("gafa-cancel-tip__msg")
        ? new DOMRect(0, 0, 230, 38)
        : measure.call(this);
    });

    act(() => button.focus());
    const tip = document.querySelector<HTMLElement>(".gafa-cancel-tip__msg")!;
    expect(tip.textContent).toBe("The cancellation window has closed");
    expect(week?.contains(tip)).toBe(false);
    expect(Number.parseFloat(tip.style.left) + 230).toBe(382);
    expect(tip.style.top).toBe("54px");

    buttonLeft = 0;
    buttonTop = 4;
    fireEvent.scroll(week!);
    expect(tip.style.left).toBe("8px");
    expect(tip.style.top).toBe("40px");
    act(() => button.blur());
    expect(tip.isConnected).toBe(false);
  });

  it("usa Brand.timeZone para un plazo sin offset cuando la reserva no trae timezone", async () => {
    setup([{ ...four, cancelableUntil: "2026-11-24 10:30:00" }]);
    const cancel = await screen.findByRole<HTMLButtonElement>("button", { name: "Cancelar Lugar 4" });
    expect(cancel.disabled).toBe(false);
    expect(cancel.getAttribute("aria-disabled")).toBe("true");
  });

  it("mantiene el botón bloqueado en la tarjeta y retira los datos de la sesión al salir", async () => {
    setup([{ ...four, canCancel: false }], { fallback: true });
    const button = await screen.findByRole<HTMLButtonElement>("button", { name: "Cancelar Lugar 4" });
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", {
      name: "Cancelar Lugar 4", description: "Ya pasó el tiempo para cancelar",
    })).toBe(button);
    act(() => clearStoredToken());
    expect(await screen.findByText("Reservado")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancelar Lugar 4" })).toBeNull();
  });

  it("repone solo el lugar fallido y permite reintentar desde la hoja", async () => {
    const { cancel, queryClient, remove } = setup([four, seven]);
    let rejectLast!: (error: Error) => void;
    cancel.mockImplementationOnce(async (_slug, id) => { remove(Number(id)); })
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectLast = reject; }));
    click(await manage());
    click(within(sheet()).getByRole("button", { name: "Cancelar los 2 lugares" }));
    click(yes());
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));
    const cache = () => queryClient.getQueriesData<Meeting[]>({ queryKey: ["calendar", "meetings"] }).flatMap(([, list]) => list ?? []);
    expect(cache()[0]).toMatchObject({ available: 3, isReserved: false });
    click(within(confirm()).getByRole("button", { name: "No, dejarla" }));
    fireEvent.keyDown(confirm(), { key: "Escape" });
    expect(confirm()).toBeTruthy();
    act(() => rejectLast(new Error("red")));
    const status = within(sheet()).getByRole("status");
    await waitFor(() => expect(status.textContent).toBe("Cancelamos tu reserva. No pudimos cancelar el lugar 7."));
    expect(getToasts()).toEqual([]);
    expect(cache()[0]).toMatchObject({ available: 2, isReserved: true });
    expect(within(sheet()).queryByText("Lugar 4")).toBeNull();
    click(within(sheet()).getByRole("button", { name: "Cancelar Lugar 7" }));
    expect(confirm().getAttribute("aria-label")).toBe("¿Cancelar Lugar 7?");
    expect(within(confirm()).queryByText(/No pudimos/)).toBeNull();
    click(yes());
    await screen.findByText("Cancelamos tu reserva.");
    expect(cancel.mock.calls.map(([, id]) => id)).toEqual([4, 7, 7]);
  });

  it("atrapa Tab, cierra solo el diálogo activo con Escape y devuelve el foco", async () => {
    setup([four, seven]);
    const opener = await manage();
    click(opener);
    const close = within(sheet()).getByRole("button", { name: "Cerrar" });
    const all = within(sheet()).getByRole("button", { name: "Cancelar los 2 lugares" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(all);
    fireEvent.keyDown(all, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    click(all);
    const keep = within(confirm()).getByRole("button", { name: "No, dejarla" });
    expect(document.activeElement).toBe(yes());
    fireEvent.keyDown(yes(), { key: "Tab" });
    expect(document.activeElement).toBe(keep);
    fireEvent.keyDown(keep, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(yes());
    fireEvent.keyDown(yes(), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(all);
    fireEvent.keyDown(all, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    click(opener);
    fireEvent.mouseDown(sheet().parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("localiza el flujo a partir de la variante francesa", async () => {
    setup([four], { language: "fr-CA" });
    expect(await screen.findByText("Réservé · Place 4")).toBeTruthy();
    click(screen.getByRole("button", { name: "Annuler Place 4" }));
    expect(confirm().getAttribute("aria-label")).toBe("Annuler la place 4\u202f?");
    click(within(confirm()).getByRole("button", { name: "Oui, annuler" }));
    await screen.findByText("Votre réservation a été annulée.");
  });
});
