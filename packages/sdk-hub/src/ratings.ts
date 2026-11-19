/** Calificaciones de clase/coach. Viven en D1 del Hub, no en gafa.fit. */

import type { GafaMember, VerifiedReservation } from "./gafaMember";
import { dayEndInZone, dayStartInZone } from "./mexicoCity";

export const RATING_COMMENT_MAX = 500;
export const RATING_STAR_MIN = 1;
export const RATING_STAR_MAX = 5;

export type ClassRatingRow = {
  id: number;
  company_id: number;
  brand_slug: string;
  brand_id: number | null;
  reservation_id: number;
  meeting_id: number | null;
  meeting_name: string | null;
  staff_id: number | null;
  staff_name: string | null;
  user_id: number;
  customer_name: string | null;
  class_stars: number | null;
  staff_stars: number | null;
  comment: string | null;
  created_at: string;
};

export type ParsedRatingInput = {
  company_id: number;
  brand_slug: string;
  brand_id: number | null;
  reservation_id: number;
  meeting_id: number | null;
  meeting_name: string | null;
  staff_id: number | null;
  staff_name: string | null;
  user_id: number;
  customer_name: string | null;
  class_stars: number | null;
  staff_stars: number | null;
  comment: string | null;
};

export type RatingStars = {
  brand_slug: string;
  reservation_id: number;
  class_stars: number | null;
  staff_stars: number | null;
  comment: string | null;
};

export type RatingParseError = {
  ok: false;
  status: 400 | 422;
  error: string;
  errors?: Record<string, string[]>;
};

export type RatingsListFilter = {
  companyId: number;
  userId?: number;
  reservationId?: number;
  staffId?: number;
  meetingId?: number;
  brandSlug?: string;
  from?: string;
  to?: string;
  q?: string;
  offset?: number;
  limit?: number;
};

export type RatingAverage = {
  id: number;
  name: string;
  avg: number;
  count: number;
};

export type RatingsSummary = {
  count: number;
  class_avg: number | null;
  staff_avg: number | null;
  classes: RatingAverage[];
  coaches: RatingAverage[];
};

/** CLASS_RATINGS default off. Encendido solo con enabled true (o true suelto). */
export function ratingsAreEnabled(config: unknown): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  const raw = (config as Record<string, unknown>).CLASS_RATINGS ?? (config as Record<string, unknown>).classRatings;
  if (raw === true || raw === 1 || raw === "true" || raw === "1") return true;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const enabled = (raw as Record<string, unknown>).enabled;
  return enabled === true || enabled === 1 || enabled === "true" || enabled === "1";
}

/** Del body solo importan marca, reserva, estrellas y comentario. El resto se ignora. */
export function parseRatingBody(input: unknown): { ok: true; rating: RatingStars } | RatingParseError {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  const raw = input as Record<string, unknown>;
  const errors: Record<string, string[]> = {};

  const brand_slug = readSlug(raw.brand_slug ?? raw.brandSlug);
  if (!brand_slug) errors.brand_slug = ["Falta la marca."];

  const reservation_id = readPositiveId(raw.reservation_id ?? raw.reservationId);
  if (!reservation_id) errors.reservation_id = ["Falta la reserva."];

  const class_stars = readOptionalStars(raw.class_stars ?? raw.classStars, "class_stars", errors);
  const staff_stars = readOptionalStars(raw.staff_stars ?? raw.staffStars, "staff_stars", errors);
  if (class_stars == null && staff_stars == null) {
    errors.stars = ["Pon al menos las estrellas de la clase o del coach."];
  }

  const commentRaw = raw.comment;
  if (commentRaw != null && typeof commentRaw !== "string") {
    errors.comment = ["El comentario tiene que ser texto."];
  }
  const comment = typeof commentRaw === "string" ? commentRaw.trim() : "";
  if (comment.length > RATING_COMMENT_MAX) {
    errors.comment = [`Máximo ${RATING_COMMENT_MAX} caracteres.`];
  }

  if (Object.keys(errors).length) {
    return { ok: false, status: 422, error: "invalid_rating", errors };
  }

  return {
    ok: true,
    rating: {
      brand_slug: brand_slug!,
      reservation_id: reservation_id!,
      class_stars,
      staff_stars,
      comment: comment || null,
    },
  };
}

export function summarizeRatings(rows: ClassRatingRow[]): RatingsSummary {
  const classValues = rows.map((row) => row.class_stars).filter((n): n is number => n != null);
  const staffValues = rows.map((row) => row.staff_stars).filter((n): n is number => n != null);
  return {
    count: rows.length,
    class_avg: average(classValues),
    staff_avg: average(staffValues),
    classes: groupAveragesById(rows, (row) => row.meeting_id, (row) => row.meeting_name, (row) => row.class_stars),
    coaches: groupAveragesById(rows, (row) => row.staff_id, (row) => row.staff_name, (row) => row.staff_stars),
  };
}

export function presentMineRating(row: ClassRatingRow) {
  return {
    id: row.id,
    company_id: row.company_id,
    brand_slug: row.brand_slug,
    reservation_id: row.reservation_id,
    meeting_id: row.meeting_id,
    meeting_name: row.meeting_name,
    staff_id: row.staff_id,
    staff_name: row.staff_name,
    class_stars: row.class_stars,
    staff_stars: row.staff_stars,
    comment: row.comment,
    created_at: row.created_at,
  };
}

export function presentAdminRating(row: ClassRatingRow) {
  return {
    ...presentMineRating(row),
    user_id: row.user_id,
    customer_name: row.customer_name,
  };
}

export const presentRating = presentAdminRating;

export type RatingsStore = {
  getMine(companyId: number, reservationId: number, userId: number): Promise<ClassRatingRow | null>;
  insert(input: ParsedRatingInput, createdAt: string): Promise<{ ok: true; rating: ClassRatingRow } | { ok: false; error: "duplicate" }>;
  list(filter: RatingsListFilter): Promise<{ rows: ClassRatingRow[]; total: number }>;
  listAll(filter: Omit<RatingsListFilter, "offset" | "limit">): Promise<ClassRatingRow[]>;
};

export function memoryRatingsStore(seed: ClassRatingRow[] = []): RatingsStore {
  const rows = [...seed];
  let nextId = rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  return {
    async getMine(companyId, reservationId, userId) {
      return (
        rows.find(
          (row) =>
            row.company_id === companyId && row.reservation_id === reservationId && row.user_id === userId,
        ) ?? null
      );
    },
    async insert(input, createdAt) {
      if (rows.some((row) => row.company_id === input.company_id && row.reservation_id === input.reservation_id)) {
        return { ok: false, error: "duplicate" };
      }
      const rating: ClassRatingRow = { id: nextId++, ...input, created_at: createdAt };
      rows.push(rating);
      return { ok: true, rating };
    },
    async list(filter) {
      const matched = filterRows(rows, filter);
      const offset = filter.offset ?? 0;
      const limit = filter.limit ?? 25;
      return { rows: matched.slice(offset, offset + limit), total: matched.length };
    },
    async listAll(filter) {
      return filterRows(rows, filter);
    },
  };
}

export function d1RatingsStore(db: D1Database): RatingsStore {
  return {
    async getMine(companyId, reservationId, userId) {
      const row = await db
        .prepare(
          `SELECT * FROM class_ratings
           WHERE company_id = ? AND reservation_id = ? AND user_id = ?
           LIMIT 1`,
        )
        .bind(companyId, reservationId, userId)
        .first<ClassRatingRow>();
      return row ?? null;
    },
    async insert(input, createdAt) {
      try {
        const result = await db
          .prepare(
            `INSERT INTO class_ratings (
              company_id, brand_slug, brand_id, reservation_id, meeting_id, meeting_name,
              staff_id, staff_name, user_id, customer_name,
              class_stars, staff_stars, comment, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
          )
          .bind(
            input.company_id,
            input.brand_slug,
            input.brand_id,
            input.reservation_id,
            input.meeting_id,
            input.meeting_name,
            input.staff_id,
            input.staff_name,
            input.user_id,
            input.customer_name,
            input.class_stars,
            input.staff_stars,
            input.comment,
            createdAt,
          )
          .first<ClassRatingRow>();
        if (!result) return { ok: false, error: "duplicate" };
        return { ok: true, rating: result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/UNIQUE/i.test(message)) return { ok: false, error: "duplicate" };
        throw error;
      }
    },
    async list(filter) {
      const { where, binds } = listWhere(filter);
      const totalRow = await db
        .prepare(`SELECT COUNT(*) AS n FROM class_ratings WHERE ${where}`)
        .bind(...binds)
        .first<{ n: number }>();
      const offset = filter.offset ?? 0;
      const limit = Math.min(50, Math.max(1, filter.limit ?? 25));
      const { results } = await db
        .prepare(`SELECT * FROM class_ratings WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .bind(...binds, limit, offset)
        .all<ClassRatingRow>();
      return { rows: results ?? [], total: Number(totalRow?.n ?? 0) };
    },
    async listAll(filter) {
      const { where, binds } = listWhere(filter);
      const { results } = await db
        .prepare(`SELECT * FROM class_ratings WHERE ${where} ORDER BY created_at DESC LIMIT 2000`)
        .bind(...binds)
        .all<ClassRatingRow>();
      return results ?? [];
    },
  };
}

function listWhere(filter: Omit<RatingsListFilter, "offset" | "limit">): { where: string; binds: unknown[] } {
  const clauses = ["company_id = ?"];
  const binds: unknown[] = [filter.companyId];
  if (filter.userId) {
    clauses.push("user_id = ?");
    binds.push(filter.userId);
  }
  if (filter.reservationId) {
    clauses.push("reservation_id = ?");
    binds.push(filter.reservationId);
  }
  if (filter.staffId) {
    clauses.push("staff_id = ?");
    binds.push(filter.staffId);
  }
  if (filter.meetingId) {
    clauses.push("meeting_id = ?");
    binds.push(filter.meetingId);
  }
  if (filter.brandSlug) {
    clauses.push("brand_slug = ?");
    binds.push(filter.brandSlug);
  }
  if (filter.from) {
    clauses.push("created_at >= ?");
    binds.push(dayStartInZone(filter.from));
  }
  if (filter.to) {
    clauses.push("created_at <= ?");
    binds.push(dayEndInZone(filter.to));
  }
  if (filter.q) {
    const like = `%${filter.q.replace(/[%_]/g, "")}%`;
    clauses.push(
      "(IFNULL(comment,'') LIKE ? OR IFNULL(customer_name,'') LIKE ? OR IFNULL(meeting_name,'') LIKE ? OR IFNULL(staff_name,'') LIKE ?)",
    );
    binds.push(like, like, like, like);
  }
  return { where: clauses.join(" AND "), binds };
}

function filterRows(rows: ClassRatingRow[], filter: RatingsListFilter): ClassRatingRow[] {
  const from = filter.from ? dayStartInZone(filter.from) : null;
  const to = filter.to ? dayEndInZone(filter.to) : null;
  const q = filter.q?.trim().toLowerCase();
  return rows
    .filter((row) => {
      if (row.company_id !== filter.companyId) return false;
      if (filter.userId && row.user_id !== filter.userId) return false;
      if (filter.reservationId && row.reservation_id !== filter.reservationId) return false;
      if (filter.staffId && row.staff_id !== filter.staffId) return false;
      if (filter.meetingId && row.meeting_id !== filter.meetingId) return false;
      if (filter.brandSlug && row.brand_slug !== filter.brandSlug) return false;
      if (from && row.created_at < from) return false;
      if (to && row.created_at > to) return false;
      if (q) {
        const hay = [row.comment, row.customer_name, row.meeting_name, row.staff_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function groupAveragesById(
  rows: ClassRatingRow[],
  idOf: (row: ClassRatingRow) => number | null,
  nameOf: (row: ClassRatingRow) => string | null,
  starsOf: (row: ClassRatingRow) => number | null,
): RatingAverage[] {
  const groups = new Map<number, { id: number; name: string; values: number[] }>();
  for (const row of rows) {
    const stars = starsOf(row);
    const id = idOf(row);
    if (stars == null || id == null) continue;
    const current = groups.get(id) ?? {
      id,
      name: nameOf(row)?.trim() || `#${id}`,
      values: [],
    };
    current.values.push(stars);
    const name = nameOf(row)?.trim();
    if (name) current.name = name;
    groups.set(id, current);
  }
  return [...groups.values()]
    .map((group) => ({
      id: group.id,
      name: group.name,
      avg: Number(average(group.values)?.toFixed(2)),
      count: group.values.length,
    }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(2));
}

function readPositiveId(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

function readOptionalStars(
  value: unknown,
  field: string,
  errors: Record<string, string[]>,
): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < RATING_STAR_MIN || n > RATING_STAR_MAX) {
    errors[field] = [`Las estrellas van de ${RATING_STAR_MIN} a ${RATING_STAR_MAX}.`];
    return null;
  }
  return n;
}

function readSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return slug && slug.length <= 80 ? slug : null;
}

export type RatingHttpResult = { status: number; json: Record<string, unknown> };

export async function createClassRating(
  store: RatingsStore,
  input: {
    enabled: boolean;
    companyId: number;
    member: GafaMember | null;
    reservation: VerifyCreateReservation;
    body: unknown;
    now?: string;
  },
): Promise<RatingHttpResult> {
  if (!input.member) {
    return { status: 401, json: { ok: false, error: "unauthorized" } };
  }
  if (!input.enabled) {
    return { status: 403, json: { ok: false, error: "ratings_disabled" } };
  }
  if (input.reservation.ok === false) {
    if (input.reservation.error === "future") {
      return {
        status: 422,
        json: { ok: false, error: "class_not_ended", errors: { reservation_id: ["La clase todavía no termina."] } },
      };
    }
    return { status: 403, json: { ok: false, error: "forbidden" } };
  }
  const parsed = parseRatingBody(input.body);
  if (!parsed.ok) {
    return {
      status: parsed.status,
      json: { ok: false, error: parsed.error, errors: parsed.errors },
    };
  }
  const verified = input.reservation.reservation;
  if (parsed.rating.reservation_id !== verified.reservation_id) {
    return { status: 403, json: { ok: false, error: "forbidden" } };
  }
  const existing = await store.getMine(input.companyId, verified.reservation_id, input.member.user_id);
  if (existing) {
    return { status: 409, json: { ok: false, error: "already_rated" } };
  }
  const result = await store.insert(
    {
      company_id: input.companyId,
      brand_slug: parsed.rating.brand_slug,
      brand_id: null,
      reservation_id: verified.reservation_id,
      meeting_id: verified.meeting_id,
      meeting_name: verified.meeting_name,
      staff_id: verified.staff_id,
      staff_name: verified.staff_name,
      user_id: input.member.user_id,
      customer_name: input.member.customer_name,
      class_stars: parsed.rating.class_stars,
      staff_stars: parsed.rating.staff_stars,
      comment: parsed.rating.comment,
    },
    input.now ?? new Date().toISOString(),
  );
  if (!result.ok) {
    return { status: 409, json: { ok: false, error: "already_rated" } };
  }
  return { status: 201, json: { ok: true, rating: presentMineRating(result.rating) } };
}

type VerifyCreateReservation =
  | { ok: true; reservation: VerifiedReservation }
  | { ok: false; error: "not_found" | "future" | "forbidden" | "unavailable" };

export async function getMyClassRating(
  store: RatingsStore,
  input: {
    enabled: boolean;
    member: GafaMember | null;
    companyId: number;
    reservationId: number;
  },
): Promise<RatingHttpResult> {
  if (!input.member) {
    return { status: 401, json: { ok: false, error: "unauthorized" } };
  }
  if (!input.enabled) {
    return { status: 403, json: { ok: false, error: "ratings_disabled" } };
  }
  if (!input.companyId || !input.reservationId) {
    return { status: 400, json: { ok: false, error: "missing_ids" } };
  }
  const row = await store.getMine(input.companyId, input.reservationId, input.member.user_id);
  return { status: 200, json: { ok: true, rating: row ? presentMineRating(row) : null } };
}

export async function listClassRatings(
  store: RatingsStore,
  filter: RatingsListFilter,
): Promise<{ rows: ClassRatingRow[]; total: number; summary: RatingsSummary }> {
  const listed = await store.list(filter);
  const all = await store.listAll(filter);
  return { rows: listed.rows, total: listed.total, summary: summarizeRatings(all) };
}

export function isRatingsSchemaMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /no such table/i.test(message);
}
