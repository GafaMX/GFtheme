import { coerceFlag } from "../cart/membershipPayOptions";
import type { UserReservation } from "../client/types";

export const CLASS_RATING_MIN = 1;
export const CLASS_RATING_MAX = 5;
export const CLASS_RATING_COMMENT_MAX = 500;

export type ClassRatingsConfig = {
  enabled: true;
  rateClass: boolean;
  rateCoach: boolean;
  promptAfterClass: boolean;
};

export type ClassRating = {
  reservationId: number;
  meetingId?: number;
  staffId?: number;
  classStars?: number | null;
  staffStars?: number | null;
  comment?: string | null;
  submittedAt?: string;
};

export type SubmitClassRatingPayload = {
  brandSlug: string;
  reservationId: number;
  meetingId?: number;
  meetingName?: string;
  staffId?: number;
  staffName?: string;
  classStars?: number | null;
  staffStars?: number | null;
  comment?: string;
};

/**
 * Default OFF. `true` = clase y coach. Objeto: `enabled` manda;
 * `rateClass` / `rateCoach` (alias `class` / `coach`) eligen qué se pide.
 */
export function parseClassRatings(input: unknown): ClassRatingsConfig | null {
  if (input == null || input === false) return null;
  if (input === true || input === 1 || input === "true" || input === "1") {
    return { enabled: true, rateClass: true, rateCoach: true, promptAfterClass: false };
  }
  if (typeof input === "string") {
    try {
      return parseClassRatings(JSON.parse(input));
    } catch {
      return null;
    }
  }
  if (typeof input !== "object" || Array.isArray(input)) return null;

  const raw = input as Record<string, unknown>;
  const enabled = coerceFlag(raw.enabled);
  if (enabled === false) return null;

  const rateClass = coerceFlag(raw.rateClass) ?? coerceFlag(raw.class);
  const rateCoach = coerceFlag(raw.rateCoach) ?? coerceFlag(raw.coach);
  const promptAfterClass = coerceFlag(raw.promptAfterClass) === true;

  if (enabled !== true && rateClass !== true && rateCoach !== true) return null;

  const classOn = rateClass !== false;
  const coachOn = rateCoach !== false;
  if (!classOn && !coachOn) return null;

  return {
    enabled: true,
    rateClass: classOn,
    rateCoach: coachOn,
    promptAfterClass,
  };
}

export function readClassRatingsFromOptions(input: unknown): ClassRatingsConfig | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  return parseClassRatings(raw.CLASS_RATINGS ?? raw.classRatings);
}

export function isValidStarValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= CLASS_RATING_MIN && value <= CLASS_RATING_MAX;
}

export function clampRatingComment(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.slice(0, CLASS_RATING_COMMENT_MAX);
}

export function isReservationRateable(
  reservation: Pick<UserReservation, "cancelled" | "isWaitlist" | "startsAt">,
  now = Date.now(),
): boolean {
  if (reservation.cancelled) return false;
  if (reservation.isWaitlist) return false;
  const start = Date.parse(reservation.startsAt);
  if (!Number.isFinite(start)) return false;
  return start <= now;
}

export function classRatingIsComplete(
  rating: Pick<ClassRating, "classStars" | "staffStars"> | null | undefined,
  config: ClassRatingsConfig,
): boolean {
  if (!rating) return false;
  if (config.rateClass && !isValidStarValue(rating.classStars)) return false;
  if (config.rateCoach && !isValidStarValue(rating.staffStars)) return false;
  return true;
}

export function enabledRatingStars(rating: ClassRating, config: ClassRatingsConfig) {
  return {
    classStars: config.rateClass && isValidStarValue(rating.classStars) ? rating.classStars : null,
    staffStars: config.rateCoach && isValidStarValue(rating.staffStars) ? rating.staffStars : null,
  };
}

export function ratingPromptStorageKey(companyId: number | undefined, reservationId: number): string {
  return `gafa-sdk:rating-prompt:${companyId ?? "x"}:${reservationId}`;
}

export function pickPromptReservation(
  history: UserReservation[],
  ratedIds: Iterable<number>,
  now = Date.now(),
): UserReservation | null {
  const rated = new Set(ratedIds);
  return (
    history.find((reservation) => isReservationRateable(reservation, now) && !rated.has(reservation.id)) ?? null
  );
}

export function normalizeClassRating(raw: unknown, fallbackReservationId: number): ClassRating | null {
  if (raw == null || raw === false) return null;
  const record = unwrapRatingRecord(raw);
  if (!record) return null;
  const reservationId =
    readPositiveId(record.reservation_id) ??
    readPositiveId(record.reservationId) ??
    readPositiveId(record.id) ??
    fallbackReservationId;
  if (!reservationId) return null;
  const classStars = readStarField(record, ["class_stars", "classStars", "meeting_stars", "meetingStars"]);
  const staffStars = readStarField(record, ["staff_stars", "staffStars", "coach_stars", "coachStars"]);
  if (classStars == null && staffStars == null && !record.comment && !record.created_at) {
    return null;
  }
  return {
    reservationId,
    meetingId: readPositiveId(record.meeting_id) ?? readPositiveId(record.meetingId) ?? undefined,
    staffId: readPositiveId(record.staff_id) ?? readPositiveId(record.staffId) ?? undefined,
    classStars,
    staffStars,
    comment: clampRatingComment(record.comment) ?? null,
    submittedAt:
      typeof record.created_at === "string"
        ? record.created_at
        : typeof record.submittedAt === "string"
          ? record.submittedAt
          : undefined,
  };
}

function unwrapRatingRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>;
  }
  if (obj.rating && typeof obj.rating === "object" && !Array.isArray(obj.rating)) {
    return obj.rating as Record<string, unknown>;
  }
  return obj;
}

function readStarField(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const n = Number(record[key]);
    if (isValidStarValue(n)) return n;
  }
  return null;
}

function readPositiveId(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}
