import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_HUB_URL,
  fetchHubReservationRating,
  hubRatingsCreateUrl,
  hubRatingsMineUrl,
  submitHubReservationRating,
} from "./hubRatings";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("hub ratings client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("apunta al Hub, no a gafa.fit", () => {
    expect(hubRatingsCreateUrl(undefined)).toBe(`${DEFAULT_HUB_URL}/v1/ratings`);
    expect(hubRatingsMineUrl("https://hub.buq.partners/", { companyId: 80, reservationId: 44, userId: 9 })).toBe(
      "https://hub.buq.partners/v1/ratings/mine?company_id=80&reservation_id=44&user_id=9",
    );
    expect(hubRatingsCreateUrl("https://buq.partners")).not.toMatch(/buq\.partners\/api/);
  });

  it("GET vacío es null", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, rating: null }));
    await expect(
      fetchHubReservationRating({ hubUrl: "https://hub.buq.partners", companyId: 80, reservationId: 44, userId: 9, fetchImpl }),
    ).resolves.toBeNull();
  });

  it("POST manda marca, reserva, coach, estrellas, comentario y cliente", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          ok: true,
          rating: {
            reservation_id: 44,
            meeting_id: 900,
            staff_id: 12,
            class_stars: 5,
            staff_stars: 4,
            comment: "Genial",
            created_at: "2026-11-19T12:00:00.000Z",
          },
        },
        201,
      ),
    );
    const rating = await submitHubReservationRating({
      hubUrl: "https://hub.buq.partners",
      payload: {
        companyId: 80,
        brandSlug: "fitspin",
        reservationId: 44,
        meetingId: 900,
        meetingName: "Bici AM",
        staffId: 12,
        staffName: "ISA",
        userId: 9,
        customerName: "Ana",
        customerEmail: "ana@buq.mx",
        classStars: 5,
        staffStars: 4,
        comment: "Genial",
      },
      fetchImpl,
    });
    expect(rating).toMatchObject({ reservationId: 44, classStars: 5, staffStars: 4, comment: "Genial" });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://hub.buq.partners/v1/ratings");
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      company_id: 80,
      brand_slug: "fitspin",
      reservation_id: 44,
      meeting_name: "Bici AM",
      staff_name: "ISA",
      user_id: 9,
      customer_email: "ana@buq.mx",
      class_stars: 5,
      staff_stars: 4,
      comment: "Genial",
    });
  });

  it("409 y 403 se leen en español", async () => {
    await expect(
      submitHubReservationRating({
        hubUrl: "https://hub.buq.partners",
        payload: { companyId: 80, brandSlug: "fitspin", reservationId: 44, userId: 9, classStars: 5 },
        fetchImpl: async () => jsonResponse({ ok: false, error: "already_rated" }, 409),
      }),
    ).rejects.toThrow(/Ya calificaste/);
    await expect(
      submitHubReservationRating({
        hubUrl: "https://hub.buq.partners",
        payload: { companyId: 80, brandSlug: "fitspin", reservationId: 44, userId: 9, classStars: 5 },
        fetchImpl: async () => jsonResponse({ ok: false, error: "ratings_disabled" }, 403),
      }),
    ).rejects.toThrow(/no acepta calificaciones/);
  });
});
