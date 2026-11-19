import { describe, expect, it, vi } from "vitest";
import {
  fetchGafaMember,
  flattenReservations,
  readBearerToken,
  readCompanyId,
  verifyGafaReservation,
} from "../src/gafaMember";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const pastPayload = {
  reservations: [
    {
      id: 44,
      meeting_start: "2026-11-01T12:00:00.000Z",
      meetings_id: 900,
      staff_id: 12,
      cancelled: false,
      meetings: { id: 900, staff: { id: 12, job: "ISA" }, service: { name: "Bici AM" } },
    },
  ],
  waitlists: [{ id: 77, meeting_start: "2026-11-01T12:00:00.000Z", is_waitlist: true }],
};

describe("gafa member + reserva", () => {
  it("lee el Bearer y el company header", () => {
    expect(readBearerToken("Bearer tok-1")).toBe("tok-1");
    expect(readBearerToken("tok-1")).toBeNull();
    expect(readCompanyId("80", 1)).toBe(80);
    expect(readCompanyId(null, "80")).toBe(80);
    expect(readCompanyId(null, null)).toBeNull();
  });

  it("GET /me con token; 401 no autentica", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe("https://buq.partners/api/me");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
      expect((init?.headers as Record<string, string>)["GAFAFIT-COMPANY"]).toBe("80");
      return jsonResponse({ id: 9, first_name: "Ana", last_name: "López", email: "ana@buq.mx" });
    });
    await expect(
      fetchGafaMember({ apiBaseUrl: "https://buq.partners", companyId: 80, token: "tok", fetchImpl }),
    ).resolves.toEqual({ ok: true, member: { user_id: 9, customer_name: "Ana López" } });

    await expect(
      fetchGafaMember({
        apiBaseUrl: "https://buq.partners",
        companyId: 80,
        token: "bad",
        fetchImpl: async () => jsonResponse({ message: "Unauthenticated" }, 401),
      }),
    ).resolves.toEqual({ ok: false, error: "unauthorized" });

    await expect(
      fetchGafaMember({
        apiBaseUrl: "https://buq.partners",
        companyId: 80,
        token: "tok",
        fetchImpl: async () => jsonResponse({ message: "timeout" }, 504),
      }),
    ).resolves.toEqual({ ok: false, error: "unavailable" });
  });

  it("aplana reservation-past y toma coach/clase de gafa.fit", () => {
    const rows = flattenReservations(pastPayload);
    expect(rows.find((row) => row.reservation_id === 44)).toMatchObject({
      meeting_id: 900,
      meeting_name: "Bici AM",
      staff_id: 12,
      staff_name: "ISA",
      isWaitlist: false,
    });
    expect(rows.find((row) => row.reservation_id === 77)?.isWaitlist).toBe(true);
  });

  it("reserva propia pasada ok; ajena not_found; futura future", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes("reservation-past")) return jsonResponse(pastPayload);
      if (href.includes("reservation-future")) {
        return jsonResponse({
          reservations: [{ id: 50, meeting_start: "2026-12-01T12:00:00.000Z", meetings: { service: { name: "Yoga" } } }],
          waitlists: [],
        });
      }
      return jsonResponse({}, 404);
    });
    const own = await verifyGafaReservation({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      token: "tok",
      brandSlug: "fitspin",
      reservationId: 44,
      now: Date.parse("2026-11-19T00:00:00.000Z"),
      fetchImpl,
    });
    expect(own).toMatchObject({ ok: true, reservation: { reservation_id: 44, staff_name: "ISA" } });

    const other = await verifyGafaReservation({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      token: "tok",
      brandSlug: "fitspin",
      reservationId: 999,
      now: Date.parse("2026-11-19T00:00:00.000Z"),
      fetchImpl,
    });
    expect(other).toEqual({ ok: false, error: "not_found" });

    const future = await verifyGafaReservation({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      token: "tok",
      brandSlug: "fitspin",
      reservationId: 50,
      now: Date.parse("2026-11-19T00:00:00.000Z"),
      fetchImpl,
    });
    expect(future).toEqual({ ok: false, error: "future" });

    const waitlist = await verifyGafaReservation({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      token: "tok",
      brandSlug: "fitspin",
      reservationId: 77,
      now: Date.parse("2026-11-19T00:00:00.000Z"),
      fetchImpl,
    });
    expect(waitlist).toEqual({ ok: false, error: "forbidden" });
  });

  it("rechaza starts_at inválido; el fin de la clase manda, no el inicio", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes("reservation-past")) {
        return jsonResponse({
          reservations: [
            { id: 88, meeting_start: "", meetings: { service: { name: "Sin hora" } } },
            {
              id: 89,
              meeting_start: "no-es-fecha",
              meetings: { service: { name: "Basura" } },
            },
            {
              id: 90,
              meeting_start: "2026-11-19T12:00:00.000Z",
              meetings: { duration: 60, service: { name: "En curso" } },
            },
            {
              id: 91,
              meeting_start: "2026-11-19T12:00:00.000Z",
              meeting_end: "2026-11-19T13:00:00.000Z",
              meetings: { service: { name: "Terminó" } },
            },
          ],
          waitlists: [],
        });
      }
      return jsonResponse({ reservations: [], waitlists: [] });
    });
    const now = Date.parse("2026-11-19T12:30:00.000Z");
    const missing = await verifyGafaReservation({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      token: "tok",
      brandSlug: "fitspin",
      reservationId: 88,
      now,
      fetchImpl,
    });
    expect(missing).toEqual({ ok: false, error: "invalid_time" });

    const garbage = await verifyGafaReservation({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      token: "tok",
      brandSlug: "fitspin",
      reservationId: 89,
      now,
      fetchImpl,
    });
    expect(garbage).toEqual({ ok: false, error: "invalid_time" });

    const running = await verifyGafaReservation({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      token: "tok",
      brandSlug: "fitspin",
      reservationId: 90,
      now,
      fetchImpl,
    });
    expect(running).toEqual({ ok: false, error: "future" });

    const done = await verifyGafaReservation({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      token: "tok",
      brandSlug: "fitspin",
      reservationId: 91,
      now: Date.parse("2026-11-19T13:00:00.000Z"),
      fetchImpl,
    });
    expect(done).toMatchObject({ ok: true, reservation: { reservation_id: 91 } });
  });

  it("si gafa.fit no responde, unavailable", async () => {
    await expect(
      verifyGafaReservation({
        apiBaseUrl: "https://buq.partners",
        companyId: 80,
        token: "tok",
        brandSlug: "fitspin",
        reservationId: 44,
        fetchImpl: async () => {
          throw Object.assign(new Error("timeout"), { status: 504 });
        },
      }),
    ).resolves.toEqual({ ok: false, error: "unavailable" });
  });
});
