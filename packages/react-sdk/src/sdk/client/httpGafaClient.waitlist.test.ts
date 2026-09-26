import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { writeStoredToken, clearStoredToken } from "./tokenStorage";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("listUserReservations: waitlist en Mi cuenta", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredToken();
  });

  function clientWith(payload: unknown) {
    writeStoredToken("token-de-prueba");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("reservation-future")) return jsonResponse(payload);
        return jsonResponse([]);
      }),
    );
    return createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 84 });
  }

  it("aplana waitlists del grupo y usa waitlist_number como lugar", async () => {
    const client = clientWith([
      {
        reservations: [],
        waitlists: [
          {
            id: 901,
            meeting_start: "2026-08-26T16:00:00.000000Z",
            waitlist_number: 3,
            service: { name: "Ride 45" },
            staff: { name: "Ana", lastname: "López" },
            location: { name: "Voltio" },
          },
        ],
      },
    ]);

    const rows = await client.listUserReservations("masvoltio");
    expect(rows).toHaveLength(1);
    expect(rows[0].isWaitlist).toBe(true);
    expect(rows[0].serviceName).toBe("Ride 45");
    expect(rows[0].waitlistPosition).toBe("3");
    expect(rows[0].canCancel).toBe(true);
    expect(rows[0].seatLabel).toBeUndefined();
  });

  it("detecta waitlist metida en reservations con is_waitlist", async () => {
    const client = clientWith([
      {
        reservations: [
          {
            id: 44,
            meeting_start: "2026-08-27T12:00:00.000000Z",
            is_waitlist: 1,
            waitlist_number: 1,
            meetings: { service: { name: "Yoga Flow" } },
            location: { name: "Condesa" },
          },
        ],
        waitlists: [],
      },
    ]);

    const rows = await client.listUserReservations("masvoltio");
    expect(rows[0].isWaitlist).toBe(true);
    expect(rows[0].serviceName).toBe("Yoga Flow");
    expect(rows[0].waitlistPosition).toBe("1");
  });

  it("no rompe si waitlists viene envuelto en { data }", async () => {
    const client = clientWith({
      reservations: [],
      waitlists: {
        data: [
          {
            id: 7,
            meeting_start: "2026-08-28T18:00:00.000000Z",
            waitlist_number: 2,
            service: { name: "Funcional" },
          },
        ],
      },
    });

    const rows = await client.listUserReservations("masvoltio");
    expect(rows[0].isWaitlist).toBe(true);
    expect(rows[0].waitlistPosition).toBe("2");
    expect(rows[0].serviceName).toBe("Funcional");
  });
});
