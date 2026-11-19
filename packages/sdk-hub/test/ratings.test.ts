import { describe, expect, it } from "vitest";
import {
  createClassRating,
  getMyClassRating,
  listClassRatings,
  memoryRatingsStore,
  parseRatingBody,
  ratingsAreEnabled,
  summarizeRatings,
  type ClassRatingRow,
} from "../src/ratings";

const base = {
  company_id: 80,
  brand_slug: "fitspin",
  reservation_id: 44,
  user_id: 9,
  class_stars: 5,
  staff_stars: 4,
};

function row(over: Partial<ClassRatingRow> = {}): ClassRatingRow {
  return {
    id: 1,
    company_id: 80,
    brand_slug: "fitspin",
    brand_id: 171,
    reservation_id: 44,
    meeting_id: 900,
    meeting_name: "Bici AM",
    staff_id: 12,
    staff_name: "ISA",
    user_id: 9,
    customer_name: "Ana",
    customer_email: "ana@buq.mx",
    class_stars: 5,
    staff_stars: 4,
    comment: "Genial",
    created_at: "2026-11-19T12:00:00.000Z",
    ...over,
  };
}

describe("CLASS_RATINGS enabled", () => {
  it("queda apagado por default y con enabled false", () => {
    expect(ratingsAreEnabled(undefined)).toBe(false);
    expect(ratingsAreEnabled({})).toBe(false);
    expect(ratingsAreEnabled({ CLASS_RATINGS: { enabled: false } })).toBe(false);
    expect(ratingsAreEnabled({ CLASS_RATINGS: { rateClass: true } })).toBe(false);
  });

  it("enciende con true suelto o enabled true", () => {
    expect(ratingsAreEnabled({ CLASS_RATINGS: true })).toBe(true);
    expect(ratingsAreEnabled({ CLASS_RATINGS: { enabled: true } })).toBe(true);
    expect(ratingsAreEnabled({ classRatings: { enabled: "true" } })).toBe(true);
  });
});

describe("parseRatingBody", () => {
  it("pide estudio, marca, reserva, cliente y al menos unas estrellas", () => {
    const miss = parseRatingBody({});
    expect(miss.ok).toBe(false);
    if (miss.ok) return;
    expect(miss.status).toBe(422);
    expect(miss.errors?.company_id).toBeTruthy();
    expect(miss.errors?.stars).toBeTruthy();
  });

  it("rechaza estrellas fuera de 1–5 y comentarios largos", () => {
    const stars = parseRatingBody({ ...base, class_stars: 6, staff_stars: 4 });
    expect(stars.ok).toBe(false);
    const comment = parseRatingBody({ ...base, comment: "x".repeat(501) });
    expect(comment.ok).toBe(false);
    if (comment.ok) return;
    expect(comment.errors?.comment?.[0]).toMatch(/500/);
  });

  it("acepta camelCase y comentario vacío", () => {
    const parsed = parseRatingBody({
      companyId: 80,
      brandSlug: "FitSpin",
      reservationId: 44,
      userId: 9,
      classStars: 3,
      comment: "   ",
      meetingName: "Bici AM",
    });
    expect(parsed).toMatchObject({
      ok: true,
      rating: {
        company_id: 80,
        brand_slug: "fitspin",
        reservation_id: 44,
        user_id: 9,
        class_stars: 3,
        staff_stars: null,
        comment: null,
        meeting_name: "Bici AM",
      },
    });
  });
});

describe("store + HTTP helpers", () => {
  it("crea y bloquea el duplicado por reserva", async () => {
    const store = memoryRatingsStore();
    const first = await createClassRating(store, { enabled: true, body: base, now: "2026-11-19T12:00:00.000Z" });
    expect(first.status).toBe(201);
    expect(first.json).toMatchObject({
      ok: true,
      rating: { reservation_id: 44, class_stars: 5, staff_stars: 4 },
    });
    const dupe = await createClassRating(store, { enabled: true, body: { ...base, user_id: 99, class_stars: 1 } });
    expect(dupe).toEqual({ status: 409, json: { ok: false, error: "already_rated" } });
  });

  it("no guarda si el estudio no prendió CLASS_RATINGS", async () => {
    const store = memoryRatingsStore();
    const result = await createClassRating(store, { enabled: false, body: base });
    expect(result.status).toBe(403);
    expect(await store.getMine(80, 44, 9)).toBeNull();
  });

  it("GET mine distingue vacío de la fila del socio", async () => {
    const store = memoryRatingsStore([row()]);
    const mine = await getMyClassRating(store, { companyId: 80, reservationId: 44, userId: 9 });
    expect(mine.json.rating).toMatchObject({ reservation_id: 44, class_stars: 5 });
    const empty = await getMyClassRating(store, { companyId: 80, reservationId: 44, userId: 8 });
    expect(empty).toEqual({ status: 200, json: { ok: true, rating: null } });
    const missing = await getMyClassRating(store, { companyId: 0, reservationId: 44, userId: 9 });
    expect(missing.status).toBe(400);
  });

  it("lista con filtro de fechas y arma promedios por clase y coach", async () => {
    const store = memoryRatingsStore([
      row({ id: 1, reservation_id: 1, meeting_id: 900, meeting_name: "Bici AM", staff_id: 12, staff_name: "ISA", class_stars: 5, staff_stars: 4, created_at: "2026-11-10T10:00:00.000Z", comment: "Ritmo" }),
      row({ id: 2, reservation_id: 2, meeting_id: 900, meeting_name: "Bici AM", staff_id: 12, staff_name: "ISA", class_stars: 3, staff_stars: 5, created_at: "2026-11-18T10:00:00.000Z", comment: "Fuerte" }),
      row({ id: 3, reservation_id: 3, meeting_id: 901, meeting_name: "Yoga", staff_id: 20, staff_name: "Ana", class_stars: 4, staff_stars: 5, created_at: "2026-11-19T10:00:00.000Z", comment: "Paz" }),
      row({ id: 4, company_id: 99, reservation_id: 4, created_at: "2026-11-19T10:00:00.000Z" }),
    ]);
    const listed = await listClassRatings(store, { companyId: 80, from: "2026-11-18", to: "2026-11-19" });
    expect(listed.total).toBe(2);
    expect(listed.summary.count).toBe(2);
    expect(listed.summary.class_avg).toBe(3.5);
    expect(listed.summary.staff_avg).toBe(5);
    expect(listed.summary.classes[0]).toMatchObject({ name: "Yoga", avg: 4, count: 1 });
    expect(listed.summary.coaches.find((row) => row.name === "Ana")).toMatchObject({ avg: 5, count: 1 });

    const q = await listClassRatings(store, { companyId: 80, q: "ritmo" });
    expect(q.total).toBe(1);
    expect(q.rows[0]?.comment).toBe("Ritmo");
  });
});

describe("summarizeRatings", () => {
  it("ignora estrellas nulas al promediar", () => {
    const summary = summarizeRatings([
      row({ class_stars: 5, staff_stars: null }),
      row({ id: 2, reservation_id: 2, class_stars: null, staff_stars: 2, staff_id: 8, staff_name: "Leo" }),
    ]);
    expect(summary.class_avg).toBe(5);
    expect(summary.staff_avg).toBe(2);
    expect(summary.classes).toHaveLength(1);
    expect(summary.coaches).toHaveLength(1);
  });
});
