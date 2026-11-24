import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "../client/httpGafaClient";
import { clearStoredToken, writeStoredToken } from "../client/tokenStorage";
import type { GafaClient, Meeting, UserReservation } from "../client/types";
import { clearToasts } from "../toast/toastStore";
import { CalendarWidget } from "./CalendarWidget";

const now = new Date("2026-11-24T16:00:00Z");
const startsAt = "2026-11-24T21:00:00Z";
const brands = [{ id: 1, name: "Fitspin CDMX", slug: "fitspin" }, { id: 2, name: "Fitspin Cancún", slug: "fitspin-cancun" }];
const location = { id: 2, name: "Cancún", slug: "cancun", brandSlug: brands[1].slug };
const meeting: Meeting = { id: 238, name: "Ride", brandSlug: brands[1].slug, startsAt, timezone: "America/Cancun", location, available: 1, capacity: 10 };

const four: UserReservation = {
  id: 4, meetingId: meeting.id, brandSlug: brands[1].slug, startsAt, serviceName: "Ride",
  seatLabel: "4", isWaitlist: false, isOverbooking: false, canCancel: true,
};
const seven: UserReservation = { ...four, id: 7, meetingId: undefined, seatLabel: "7" };

function setup(own: UserReservation[], { session = true, fallback = false, language }: {
  session?: boolean; fallback?: boolean; language?: string;
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
      <CalendarWidget client={client} language={language} allowViewChange={false} />
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
const manage = () => screen.findByRole("button", { name: "Ver o cancelar tus lugares" });
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
    const vm = setup([four], { session: false });
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
    await screen.findByText("Cancelamos tu reserva.");
    expect(post).toHaveBeenCalledExactlyOnceWith("https://example.test/api/me/brand/fitspin-cancun/reservation-future/4/cancel", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText("2/10 lugares")).toBeTruthy();
    expect(screen.queryByText("Reservado · Lugar 4")).toBeNull();
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

  it("deja Cancelar bloqueado con un tooltip y la acción colectiva bloqueada si algún lugar venció", async () => {
    setup([{ ...four, canCancel: false }, seven]);
    click(await manage());
    for (const name of ["Cancelar Lugar 4", "Cancelar los 2 lugares"]) {
      const button = within(sheet()).getByRole("button", { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
      const tip = document.getElementById(button.getAttribute("aria-describedby") ?? "");
      expect(tip?.getAttribute("role")).toBe("tooltip");
      expect(tip?.textContent).toBe("Ya pasó el tiempo para cancelar");
    }
    expect((within(sheet()).getByRole("button", { name: "Cancelar Lugar 7" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("mantiene el botón bloqueado en la tarjeta y retira los datos de la sesión al salir", async () => {
    setup([{ ...four, canCancel: false }], { fallback: true });
    const button = await screen.findByRole<HTMLButtonElement>("button", { name: "Cancelar Lugar 4" });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("tooltip").id).toBe(button.getAttribute("aria-describedby"));
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
    await screen.findByText("No pudimos cancelar Lugar 7.");
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
    expect(confirm().getAttribute("aria-label")).toBe("Annuler la place 4 ?");
    click(within(confirm()).getByRole("button", { name: "Oui, annuler" }));
    await screen.findByText("Votre réservation a été annulée.");
  });
});
