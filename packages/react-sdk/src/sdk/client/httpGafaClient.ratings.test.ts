import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { clearStoredToken, writeStoredToken } from "./tokenStorage";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => handler(String(url), init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("reservation ratings HTTP", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredToken();
  });

  it("GET vacío en el Hub se lee como null y manda el Bearer", async () => {
    writeStoredToken("token-de-prueba");
    const fetchMock = stubFetch((url) => {
      if (url.includes("/v1/ratings/mine")) return jsonResponse({ ok: true, rating: null });
      return jsonResponse({ message: "Not Found" }, 404);
    });
    const client = createHttpGafaClient({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      hubUrl: "https://hub.buq.partners",
    });
    await expect(client.getReservationRating?.("fitspin", 44)).resolves.toBeNull();
    const call = fetchMock.mock.calls.find((item) => String(item[0]).includes("/v1/ratings/mine"));
    expect(call?.[1]?.headers).toMatchObject({
      Authorization: "Bearer token-de-prueba",
      "GAFAFIT-COMPANY": "80",
    });
  });

  it("POST manda la calificación al Hub con token, sin identidad en el body", async () => {
    writeStoredToken("token-de-prueba");
    const fetchMock = stubFetch((url) => {
      if (url.endsWith("/v1/ratings")) {
        return jsonResponse(
          {
            ok: true,
            rating: {
              reservation_id: 44,
              class_stars: 5,
              staff_stars: 4,
              comment: "Genial",
              created_at: "2026-01-02T00:00:00.000Z",
            },
          },
          201,
        );
      }
      return jsonResponse({ message: "Not Found" }, 404);
    });
    const client = createHttpGafaClient({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      hubUrl: "https://hub.buq.partners",
    });
    const rating = await client.submitReservationRating?.({
      brandSlug: "fitspin",
      reservationId: 44,
      meetingName: "ignorado",
      staffName: "ignorado",
      classStars: 5,
      staffStars: 4,
      comment: "Genial",
    });
    expect(rating).toMatchObject({ reservationId: 44, classStars: 5 });
    const post = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/v1/ratings"));
    const body = JSON.parse(String((post?.[1] as RequestInit).body));
    expect(body).toEqual({
      brand_slug: "fitspin",
      reservation_id: 44,
      class_stars: 5,
      staff_stars: 4,
      comment: "Genial",
    });
    expect(post?.[1]?.headers).toMatchObject({ Authorization: "Bearer token-de-prueba" });
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/me/brand/") && String(call[0]).includes("/rating"))).toBe(
      false,
    );
  });

  it("POST 503 explica que el Hub aún no tiene la tabla", async () => {
    writeStoredToken("token-de-prueba");
    stubFetch(() => jsonResponse({ ok: false, error: "ratings_unavailable" }, 503));
    const client = createHttpGafaClient({
      apiBaseUrl: "https://buq.partners",
      companyId: 80,
      hubUrl: "https://hub.buq.partners",
    });
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
    stubFetch(() =>
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
    );
    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    const rows = await client.listUserReservations("fitspin", "past");
    expect(rows[0]).toMatchObject({ id: 44, meetingId: 900, staffId: 12, staffName: "ISA" });
  });
});
