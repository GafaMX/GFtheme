import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_HUB_URL,
  fetchHubReservationRating,
  hubRatingHeaders,
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

  it("apunta al Hub y manda el Bearer de gafa.fit", () => {
    expect(hubRatingsCreateUrl(undefined)).toBe(`${DEFAULT_HUB_URL}/v1/ratings`);
    expect(hubRatingsMineUrl("https://hub.buq.partners/", { companyId: 80, reservationId: 44 })).toBe(
      "https://hub.buq.partners/v1/ratings/mine?company_id=80&reservation_id=44",
    );
    expect(hubRatingHeaders(80, "tok")).toMatchObject({
      Authorization: "Bearer tok",
      "GAFAFIT-COMPANY": "80",
    });
  });

  it("GET vacío es null", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, rating: null }));
    await expect(
      fetchHubReservationRating({
        hubUrl: "https://hub.buq.partners",
        companyId: 80,
        token: "tok",
        reservationId: 44,
        fetchImpl,
      }),
    ).resolves.toBeNull();
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tok",
    });
  });

  it("POST manda solo marca, reserva, estrellas y comentario", async () => {
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
    await submitHubReservationRating({
      hubUrl: "https://hub.buq.partners",
      payload: {
        companyId: 80,
        token: "tok",
        brandSlug: "fitspin",
        reservationId: 44,
        classStars: 5,
        staffStars: 4,
        comment: "Genial",
      },
      fetchImpl,
    });
    const body = JSON.parse(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toEqual({
      brand_slug: "fitspin",
      reservation_id: 44,
      class_stars: 5,
      staff_stars: 4,
      comment: "Genial",
    });
    expect(body).not.toHaveProperty("user_id");
    expect(body).not.toHaveProperty("customer_email");
    expect(body).not.toHaveProperty("meeting_name");
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tok",
      "GAFAFIT-COMPANY": "80",
    });
  });

  it("401 sin token del Hub", async () => {
    await expect(
      submitHubReservationRating({
        hubUrl: "https://hub.buq.partners",
        payload: { companyId: 80, token: "x", brandSlug: "fitspin", reservationId: 44, classStars: 5 },
        fetchImpl: async () => jsonResponse({ ok: false, error: "unauthorized" }, 401),
      }),
    ).rejects.toThrow(/Inicia sesión/);
  });
});
