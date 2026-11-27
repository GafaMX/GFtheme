import { describe, expect, it } from "vitest";
import {
  classRatingIsComplete,
  isReservationRateable,
  normalizeClassRating,
  parseClassRatings,
  pickPromptReservation,
} from "./classRatings";
import type { UserReservation } from "../client/types";

function reservation(partial: Partial<UserReservation> = {}): UserReservation {
  return {
    id: 1,
    serviceName: "Bici AM",
    startsAt: "2026-01-01T12:00:00.000Z",
    brandSlug: "fitspin",
    isWaitlist: false,
    isOverbooking: false,
    ...partial,
  };
}

describe("parseClassRatings", () => {
  it("default off: ausente, false o vacío", () => {
    expect(parseClassRatings(undefined)).toBeNull();
    expect(parseClassRatings(false)).toBeNull();
    expect(parseClassRatings({})).toBeNull();
    expect(parseClassRatings({ enabled: false, rateClass: true })).toBeNull();
  });

  it("true prende clase y coach, sin prompt", () => {
    expect(parseClassRatings(true)).toEqual({
      enabled: true,
      rateClass: true,
      rateCoach: true,
      promptAfterClass: false,
    });
  });

  it("enabled true pide ambos si no se dice lo contrario", () => {
    expect(parseClassRatings({ enabled: true })).toEqual({
      enabled: true,
      rateClass: true,
      rateCoach: true,
      promptAfterClass: false,
    });
  });

  it("puede pedir solo clase o solo coach", () => {
    expect(parseClassRatings({ enabled: true, rateClass: true, rateCoach: false })).toMatchObject({
      rateClass: true,
      rateCoach: false,
    });
    expect(parseClassRatings({ enabled: true, class: false, coach: true, promptAfterClass: true })).toMatchObject({
      rateClass: false,
      rateCoach: true,
      promptAfterClass: true,
    });
  });

  it("si ambos están en no, no se activa", () => {
    expect(parseClassRatings({ enabled: true, rateClass: false, rateCoach: false })).toBeNull();
  });
});

describe("isReservationRateable", () => {
  const now = Date.parse("2026-06-01T12:00:00.000Z");

  it("solo clases ya terminadas, no canceladas ni waitlist", () => {
    expect(isReservationRateable(reservation(), now)).toBe(true);
    expect(isReservationRateable(reservation({ cancelled: true }), now)).toBe(false);
    expect(isReservationRateable(reservation({ isWaitlist: true }), now)).toBe(false);
    expect(isReservationRateable(reservation({ startsAt: "2026-12-01T12:00:00.000Z" }), now)).toBe(false);
  });
});

describe("classRatingIsComplete / normalizeClassRating", () => {
  const both = parseClassRatings(true)!;

  it("una calificación por reserva: faltan estrellas = incompleta", () => {
    expect(classRatingIsComplete({ classStars: 5 }, both)).toBe(false);
    expect(classRatingIsComplete({ classStars: 5, staffStars: 4 }, both)).toBe(true);
  });

  it("normaliza snake_case y data envelope", () => {
    expect(
      normalizeClassRating(
        { data: { reservation_id: 9, class_stars: 5, staff_stars: 3, comment: "Genial", created_at: "2026-01-02" } },
        9,
      ),
    ).toEqual({
      reservationId: 9,
      meetingId: undefined,
      staffId: undefined,
      classStars: 5,
      staffStars: 3,
      comment: "Genial",
      submittedAt: "2026-01-02",
    });
  });
});

describe("pickPromptReservation", () => {
  it("elige la más reciente sin calificar", () => {
    const history = [
      reservation({ id: 3, startsAt: "2026-05-03T12:00:00.000Z" }),
      reservation({ id: 2, startsAt: "2026-05-02T12:00:00.000Z" }),
    ];
    expect(pickPromptReservation(history, [3], Date.parse("2026-06-01T00:00:00.000Z"))?.id).toBe(2);
  });
});
