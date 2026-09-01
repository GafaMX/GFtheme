import { afterEach, describe, expect, it, vi } from "vitest";
import { createSdkTracker } from "./tracker";
import { instrumentClient } from "./instrumentClient";
import type { GafaClient } from "../client/types";

describe("sdk tracker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
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

  it("envuelve login y reserva sin cambiar el resultado", async () => {
    const events: string[] = [];
    const userIds: Array<number | null> = [];
    const tracker = {
      sessionId: "t",
      track: (input: { event: string }) => events.push(input.event),
      heartbeat() {},
      setUserId(id: number | null) {
        userIds.push(id);
      },
      setUser(user: { id: number | null }) {
        userIds.push(user.id);
      },
      flush() {},
    };
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
    expect(events).toEqual(["auth.login_succeeded", "reservation.confirmed"]);
    expect(client.getProfile).toHaveBeenCalled();
    expect(userIds).toEqual([44]);
  });

  it("login fallido emite auth.login_failed y relanza", async () => {
    const events: string[] = [];
    const tracker = {
      sessionId: "t",
      track: (input: { event: string }) => events.push(input.event),
      heartbeat() {},
      setUserId() {},
      setUser() {},
      flush() {},
    };
    const client = {
      login: vi.fn(async () => {
        throw new Error("bad");
      }),
      logout: vi.fn(),
      register: vi.fn(async () => ({})),
      cancelReservation: vi.fn(async () => undefined),
    } as unknown as GafaClient;

    await expect(instrumentClient(client, tracker).login({ email: "a", password: "b" })).rejects.toThrow("bad");
    expect(events).toEqual(["auth.login_failed"]);
  });
});
