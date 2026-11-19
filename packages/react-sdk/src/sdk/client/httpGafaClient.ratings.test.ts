import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { clearStoredToken, writeStoredToken } from "./tokenStorage";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("reservation ratings HTTP", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredToken();
  });

  it("GET 404 (endpoint o sin calificación) se lee como null", async () => {
    writeStoredToken("token-de-prueba");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Not Found" }, 404)),
    );
    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    await expect(client.getReservationRating?.("fitspin", 44)).resolves.toBeNull();
  });

  it("POST manda el contrato documentado", async () => {
    writeStoredToken("token-de-prueba");
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        reservation_id: 44,
        meeting_id: 900,
        staff_id: 12,
        class_stars: 5,
        staff_stars: 4,
        comment: "Genial",
        created_at: "2026-01-02T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    const rating = await client.submitReservationRating?.({
      brandSlug: "fitspin",
      reservationId: 44,
      meetingId: 900,
      staffId: 12,
      classStars: 5,
      staffStars: 4,
      comment: "Genial",
    });
    expect(rating).toMatchObject({ reservationId: 44, classStars: 5, staffStars: 4, comment: "Genial" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://buq.partners/api/me/brand/fitspin/reservations/44/rating",
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("class_stars")).toBe("5");
    expect(body.get("staff_stars")).toBe("4");
    expect(body.get("comment")).toBe("Genial");
    expect(body.get("meeting_id")).toBe("900");
    expect(body.get("staff_id")).toBe("12");
  });

  it("POST 404 explica que el backend aún no existe", async () => {
    writeStoredToken("token-de-prueba");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "Not Found" }, 404)));
    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    await expect(
      client.submitReservationRating?.({
        brandSlug: "fitspin",
        reservationId: 44,
        classStars: 5,
        staffStars: 5,
      }),
    ).rejects.toThrow(/aún no puede guardar calificaciones/i);
  });

  it("mapea meeting_id y staff_id del historial", async () => {
    writeStoredToken("token-de-prueba");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          reservations: [
            {
              id: 44,
              meeting_start: "2026-01-01T12:00:00.000Z",
              meetings_id: 900,
              staff_id: 12,
              meetings: { id: 900, staff: { id: 12, name: "ISA" }, service: { name: "Bici" } },
            },
          ],
          waitlists: [],
        }),
      ),
    );
    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    const rows = await client.listUserReservations("fitspin", "past");
    expect(rows[0]).toMatchObject({ id: 44, meetingId: 900, staffId: 12, staffName: "ISA" });
  });
});
