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
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeacon });

    const tracker = createSdkTracker({
      hubUrl: "https://hub.buq.partners",
      companyId: 80,
    });
    tracker.track({ event: "auth.login_succeeded", widget: "auth" });
    tracker.flush();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toBe("https://hub.buq.partners/v1/events");
    expect(blob).toBeInstanceOf(Blob);
  });

  it("no pega si analytics está apagado", () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeacon });
    const tracker = createSdkTracker({ hubUrl: "https://hub.buq.partners", companyId: 80, enabled: false });
    tracker.heartbeat(["meetings-calendar"]);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("incluye user_id persistido en el batch", async () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeacon });

    const tracker = createSdkTracker({
      hubUrl: "https://hub.buq.partners",
      companyId: 80,
    });
    tracker.setUserId(44);
    tracker.track({ event: "checkout.paid", widget: "checkout", props: { purchase_id: 12 } });
    tracker.flush();

    const blob = sendBeacon.mock.calls[0][1] as Blob;
    const body = JSON.parse(await blob.text()) as { events: Array<{ user_id: number; event: string }> };
    expect(body.events[0]).toMatchObject({ event: "checkout.paid", user_id: 44 });
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
