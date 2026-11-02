import { afterEach, describe, expect, it, vi } from "vitest";
import { createSdkTracker, type HubUser, type SdkTracker } from "./tracker";
import { instrumentClient } from "./instrumentClient";
import type { GafaClient } from "../client/types";
import type { TrackInput } from "./events";

function fakeTracker() {
  const events: TrackInput[] = [];
  const userIds: Array<number | null> = [];
  let user: HubUser = { id: null, name: null, email: null };
  const tracker: SdkTracker = {
    sessionId: "t",
    track: (input) => {
      events.push(input);
    },
    heartbeat() {},
    getUser() {
      return user;
    },
    setUserId(id) {
      user = id == null ? { id: null, name: null, email: null } : { ...user, id };
      userIds.push(id);
    },
    setUser(next) {
      user = { id: next.id, name: next.name ?? null, email: next.email ?? null };
      userIds.push(next.id);
    },
    flush() {},
  };
  return { tracker, events, userIds };
}

describe("sdk tracker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("manda un batch al Hub y nunca tira", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);

    const tracker = createSdkTracker({
      hubUrl: "https://hub.buq.partners",
      companyId: 80,
    });
    tracker.track({ event: "auth.login_succeeded", widget: "auth" });
    tracker.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hub.buq.partners/v1/events");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(init.keepalive).toBe(true);
  });

  it("no pega si analytics está apagado", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    const tracker = createSdkTracker({ hubUrl: "https://hub.buq.partners", companyId: 80, enabled: false });
    tracker.heartbeat(["meetings-calendar"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("incluye user_id persistido en el batch", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);

    const tracker = createSdkTracker({
      hubUrl: "https://hub.buq.partners",
      companyId: 80,
    });
    tracker.setUserId(44);
    tracker.track({ event: "checkout.paid", widget: "checkout", props: { purchase_id: 12 } });
    tracker.flush();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as { events: Array<{ user_id: number; event: string }> };
    expect(body.events[0]).toMatchObject({ event: "checkout.paid", user_id: 44 });
  });

  it("manda nombre y correo en el batch cuando hay perfil", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    const tracker = createSdkTracker({ hubUrl: "https://hub.buq.partners", companyId: 80 });
    tracker.setUser({ id: 44, name: "Ana Ruiz", email: "ana@fitspin.mx" });
    tracker.track({ event: "auth.login_succeeded", widget: "auth" });
    tracker.flush();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      events: Array<{ props?: { user_name?: string; user_email?: string } }>;
    };
    expect(body.events[0].props).toMatchObject({ user_name: "Ana Ruiz", user_email: "ana@fitspin.mx" });
  });

  it("recuerda nombre y correo en localStorage para otra pestaña", () => {
    const first = createSdkTracker({ hubUrl: "https://hub.buq.partners", companyId: 80 });
    first.setUser({ id: 44, name: "Ana Ruiz", email: "ana@fitspin.mx" });
    sessionStorage.clear();
    const second = createSdkTracker({ hubUrl: "https://hub.buq.partners", companyId: 80 });
    expect(second.getUser()).toMatchObject({ id: 44, name: "Ana Ruiz", email: "ana@fitspin.mx" });
  });

  it("envuelve login y reserva sin cambiar el resultado", async () => {
    const { tracker, events, userIds } = fakeTracker();
    const client = {
      login: vi.fn(async () => ({ access_token: "tok" })),
      getProfile: vi.fn(async () => ({ id: 44, name: "Ana", email: "a@b.c" })),
      logout: vi.fn(),
      register: vi.fn(async () => ({})),
      cancelReservation: vi.fn(async () => undefined),
      createReservation: vi.fn(async () => ({ reservationId: 9, isWaitlist: false })),
    } as unknown as GafaClient;

    const wrapped = instrumentClient(client, tracker);
    await wrapped.login({ email: "a@b.c", password: "x" });
    await wrapped.createReservation?.({
      brandSlug: "fitspin",
      locationSlug: "lomas",
      meetingId: 1,
      userProfileId: 2,
    });
    expect(events.map((item) => item.event)).toEqual(["auth.login_succeeded", "reservation.confirmed"]);
    expect(client.getProfile).toHaveBeenCalled();
    expect(userIds).toEqual([44]);
  });

  it("una reserva con sesión ya abierta manda nombre y correo, no solo el id", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    const tracker = createSdkTracker({ hubUrl: "https://hub.buq.partners", companyId: 80 });
    const client = {
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      getProfile: vi.fn(async () => ({ id: 44, name: "Ana Ruiz", email: "ana@fitspin.mx" })),
      cancelReservation: vi.fn(),
      createReservation: vi.fn(async () => ({ reservationId: 9, isWaitlist: false })),
    } as unknown as GafaClient;

    const wrapped = instrumentClient(client, tracker);
    await wrapped.createReservation?.({
      brandSlug: "hybrix",
      locationSlug: "roma",
      meetingId: 88,
      userProfileId: 44,
    });
    tracker.flush();

    expect(client.getProfile).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      events: Array<{ event: string; user_id: number; props?: { user_name?: string; user_email?: string } }>;
    };
    expect(body.events[0]).toMatchObject({
      event: "reservation.confirmed",
      user_id: 44,
      props: { user_name: "Ana Ruiz", user_email: "ana@fitspin.mx", meeting_id: 88, reservation_id: 9 },
    });
  });

  it("marca checkout.paid cuando el pago cierra, aunque no haya reserva", async () => {
    const { tracker, events } = fakeTracker();
    const client = {
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      getProfile: vi.fn(async () => null),
      cancelReservation: vi.fn(),
      pollInitialPurchaseStatus: vi.fn(async () => ({ code: 1, purchaseId: 88 })),
    } as unknown as GafaClient;

    const wrapped = instrumentClient(client, tracker);
    await wrapped.pollInitialPurchaseStatus?.({
      brandSlug: "fitspin",
      locationSlug: "lomas",
      checkoutToken: "chk",
      pendingPurchaseId: 88,
    });
    expect(events.map((item) => item.event)).toEqual(["checkout.paid"]);
  });

  it("login fallido emite auth.login_failed y relanza", async () => {
    const { tracker, events } = fakeTracker();
    const client = {
      login: vi.fn(async () => {
        throw new Error("bad");
      }),
      logout: vi.fn(),
      register: vi.fn(async () => ({})),
      getProfile: vi.fn(),
      cancelReservation: vi.fn(async () => undefined),
    } as unknown as GafaClient;

    await expect(instrumentClient(client, tracker).login({ email: "a", password: "b" })).rejects.toThrow("bad");
    expect(events.map((item) => item.event)).toEqual(["auth.login_failed"]);
  });
});
