import { describe, expect, it } from "vitest";
import {
  createClassRating,
  getMyClassRating,
  listClassRatings,
  memoryRatingsStore,
  parseRatingBody,
  presentMineRating,
  ratingsAreEnabled,
  summarizeRatings,
  type ClassRatingRow,
} from "../src/ratings";

const stars = {
  brand_slug: "fitspin",
  reservation_id: 44,
  class_stars: 5,
  staff_stars: 4,
};

const member = { user_id: 9, customer_name: "Ana" };
const reservation = {
  ok: true as const,
  reservation: {
    reservation_id: 44,
    meeting_id: 900,
    meeting_name: "Bici AM",
    staff_id: 12,
    staff_name: "ISA",
    starts_at: "2026-11-01T12:00:00.000Z",
  },
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
  });
});

describe("parseRatingBody", () => {
  it("pide marca, reserva y al menos unas estrellas; ignora identidad del body", () => {
    const miss = parseRatingBody({ user_id: 9, company_id: 80 });
    expect(miss.ok).toBe(false);
    if (miss.ok) return;
    expect(miss.status).toBe(422);
    expect(miss.errors?.reservation_id).toBeTruthy();
    expect(miss.errors?.stars).toBeTruthy();

    const parsed = parseRatingBody({
      brandSlug: "FitSpin",
      reservationId: 44,
      classStars: 3,
      user_id: 1,
      customer_name: "Mallory",
      customer_email: "x@evil",
      meeting_name: "HACK",
      staff_name: "HACK",
    });
    expect(parsed).toEqual({
      ok: true,
      rating: {
        brand_slug: "fitspin",
        reservation_id: 44,
        class_stars: 3,
        staff_stars: null,
        comment: null,
      },
    });
  });
});

describe("createClassRating auth", () => {
  it("sin socio autenticado da 401", async () => {
    const result = await createClassRating(memoryRatingsStore(), {
      enabled: true,
      companyId: 80,
      member: null,
      reservation,
      body: stars,
    });
    expect(result.status).toBe(401);
  });

  it("reserva ajena o inexistente da 403 y no inserta", async () => {
    const store = memoryRatingsStore();
    const result = await createClassRating(store, {
      enabled: true,
      companyId: 80,
      member,
      reservation: { ok: false, error: "not_found" },
      body: stars,
    });
    expect(result.status).toBe(403);
    expect(await store.getMine(80, 44, 9)).toBeNull();
  });

  it("clase futura da 422", async () => {
    const result = await createClassRating(memoryRatingsStore(), {
      enabled: true,
      companyId: 80,
      member,
      reservation: { ok: false, error: "future" },
      body: stars,
    });
    expect(result.status).toBe(422);
    expect(result.json.error).toBe("class_not_ended");
  });

  it("ignora nombres y user_id del body; toma coach y clase de gafa.fit", async () => {
    const store = memoryRatingsStore();
    const result = await createClassRating(store, {
      enabled: true,
      companyId: 80,
      member,
      reservation,
      body: {
        ...stars,
        user_id: 1,
        customer_name: "Mallory",
        customer_email: "mallory@evil",
        meeting_name: "HACK",
        staff_name: "HACK",
        meeting_id: 1,
        staff_id: 1,
      },
      now: "2026-11-19T12:00:00.000Z",
    });
    expect(result.status).toBe(201);
    expect(result.json.rating).toMatchObject({
      reservation_id: 44,
      meeting_name: "Bici AM",
      staff_name: "ISA",
      meeting_id: 900,
      staff_id: 12,
      class_stars: 5,
    });
    expect(result.json.rating).not.toHaveProperty("customer_email");
    expect(result.json.rating).not.toHaveProperty("user_id");
    const saved = await store.getMine(80, 44, 9);
    expect(saved?.user_id).toBe(9);
    expect(saved?.customer_name).toBe("Ana");
    expect(saved?.meeting_name).toBe("Bici AM");
    expect(saved).not.toHaveProperty("customer_email");
  });

  it("409 solo si el mismo socio ya calificó esa reserva verificada", async () => {
    const store = memoryRatingsStore();
    const first = await createClassRating(store, {
      enabled: true,
      companyId: 80,
      member,
      reservation,
      body: stars,
    });
    expect(first.status).toBe(201);
    const dupe = await createClassRating(store, {
      enabled: true,
      companyId: 80,
      member,
      reservation,
      body: { ...stars, class_stars: 1 },
    });
    expect(dupe).toEqual({ status: 409, json: { ok: false, error: "already_rated" } });
    const other = await createClassRating(store, {
      enabled: true,
      companyId: 80,
      member: { user_id: 99, customer_name: "Otra" },
      reservation: { ok: false, error: "not_found" },
      body: { ...stars, reservation_id: 44 },
    });
    expect(other.status).toBe(403);
  });

  it("no guarda si CLASS_RATINGS está apagado", async () => {
    const store = memoryRatingsStore();
    const result = await createClassRating(store, {
      enabled: false,
      companyId: 80,
      member,
      reservation,
      body: stars,
    });
    expect(result.status).toBe(403);
    expect(result.json.error).toBe("ratings_disabled");
  });
});

describe("GET mine", () => {
  it("sin token da 401; apagado da 403; aísla por socio", async () => {
    const store = memoryRatingsStore([row(), row({ id: 2, user_id: 8, reservation_id: 44, comment: "Ajeno" })]);
    expect(
      (await getMyClassRating(store, { enabled: true, member: null, companyId: 80, reservationId: 44 })).status,
    ).toBe(401);
    expect(
      (await getMyClassRating(store, { enabled: false, member, companyId: 80, reservationId: 44 })).json.error,
    ).toBe("ratings_disabled");
    const mine = await getMyClassRating(store, { enabled: true, member, companyId: 80, reservationId: 44 });
    expect(mine.status).toBe(200);
    expect(mine.json.rating).toMatchObject({ comment: "Genial", reservation_id: 44 });
    expect(mine.json.rating).not.toHaveProperty("customer_email");
    const otherOwn = await getMyClassRating(store, {
      enabled: true,
      member: { user_id: 8, customer_name: "Otra" },
      companyId: 80,
      reservationId: 44,
    });
    expect(otherOwn.json.rating).toMatchObject({ comment: "Ajeno" });
    const other = await getMyClassRating(store, {
      enabled: true,
      member: { user_id: 8, customer_name: "Otra" },
      companyId: 80,
      reservationId: 99,
    });
    expect(other.json.rating).toBeNull();
  });
});

describe("list + promedios por ID verificado", () => {
  it("agrupa por meeting_id y staff_id, no por nombre", async () => {
    const summary = summarizeRatings([
      row({ meeting_id: 900, meeting_name: "Bici", staff_id: 12, staff_name: "ISA", class_stars: 5, staff_stars: 4 }),
      row({
        id: 2,
        reservation_id: 2,
        meeting_id: 901,
        meeting_name: "Bici",
        staff_id: 13,
        staff_name: "ISA",
        class_stars: 1,
        staff_stars: 5,
      }),
      row({ id: 3, reservation_id: 3, meeting_id: null, meeting_name: "Huérfana", class_stars: 5, staff_id: null }),
    ]);
    expect(summary.classes).toHaveLength(2);
    expect(summary.classes.map((item) => item.id).sort()).toEqual([900, 901]);
    expect(summary.coaches).toHaveLength(2);
  });

  it("filtra fechas en America/Mexico_City", async () => {
    const store = memoryRatingsStore([
      row({ id: 1, reservation_id: 1, created_at: "2026-11-18T05:59:59.000Z", comment: "antes" }),
      row({ id: 2, reservation_id: 2, created_at: "2026-11-18T06:00:00.000Z", comment: "cdmx" }),
      row({ id: 3, reservation_id: 3, created_at: "2026-11-19T05:59:59.999Z", comment: "fin" }),
    ]);
    const listed = await listClassRatings(store, { companyId: 80, from: "2026-11-18", to: "2026-11-18" });
    expect(listed.rows.map((item) => item.comment)).toEqual(["fin", "cdmx"]);
  });
});

describe("presentMineRating", () => {
  it("no expone email ni user_id", () => {
    const view = presentMineRating(row());
    expect(view).not.toHaveProperty("customer_email");
    expect(view).not.toHaveProperty("user_id");
    expect(view).not.toHaveProperty("customer_name");
  });
});
