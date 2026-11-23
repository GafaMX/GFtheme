/** Identidad y reserva del socio: el Hub las lee de gafa.fit, nunca del body. */

const REQUEST_MS = 8_000;
const MAX_PAGES = 8;
const PAGE_SIZE = 50;

export type GafaMember = {
  user_id: number;
  customer_name: string | null;
};

export type VerifiedReservation = {
  reservation_id: number;
  meeting_id: number | null;
  meeting_name: string | null;
  staff_id: number | null;
  staff_name: string | null;
  starts_at: string;
};

export type VerifyReservationResult =
  | { ok: true; reservation: VerifiedReservation }
  | { ok: false; error: "not_found" | "future" | "forbidden" | "unavailable" | "invalid_time" };

export const DEFAULT_CLASS_MINUTES = 60;

export type FetchGafaMemberResult =
  | { ok: true; member: GafaMember }
  | { ok: false; error: "unauthorized" | "unavailable" };

type FetchLike = typeof fetch;

export function readBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = header.trim().match(/^Bearer\s+(\S+)/i);
  return match?.[1] ?? null;
}

export function readCompanyId(
  header: string | null | undefined,
  fallback?: unknown,
): number | null {
  const fromHeader = positiveId(header);
  if (fromHeader) return fromHeader;
  return positiveId(fallback) ?? null;
}

export async function fetchGafaMember(input: {
  apiBaseUrl: string;
  companyId: number;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<FetchGafaMemberResult> {
  try {
    const payload = await gafaAuthedGet(input, "/me");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, error: "unauthorized" };
    }
    const raw = payload as Record<string, unknown>;
    const user_id = positiveId(raw.id);
    if (!user_id) return { ok: false, error: "unauthorized" };
    const name =
      [raw.first_name, raw.last_name]
        .filter((part): part is string => typeof part === "string" && part.trim() !== "")
        .join(" ")
        .trim() ||
      (typeof raw.name === "string" ? raw.name.trim() : "") ||
      null;
    return { ok: true, member: { user_id, customer_name: name || null } };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) return { ok: false, error: "unauthorized" };
    return { ok: false, error: "unavailable" };
  }
}

export async function verifyGafaReservation(input: {
  apiBaseUrl: string;
  companyId: number;
  token: string;
  brandSlug: string;
  reservationId: number;
  now?: number;
  fetchImpl?: FetchLike;
}): Promise<VerifyReservationResult> {
  const now = input.now ?? Date.now();
  try {
    const past = await findReservation(input, "reservation-past");
    if (past) return decideReservation(past, now);
    const future = await findReservation(input, "reservation-future");
    if (future) return decideReservation(future, now);
    return { ok: false, error: "not_found" };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) return { ok: false, error: "forbidden" };
    return { ok: false, error: "unavailable" };
  }
}

function decideReservation(row: FoundReservation, now: number): VerifyReservationResult {
  if (row.cancelled || row.isWaitlist) return { ok: false, error: "forbidden" };
  const endedAt = classEndMs(row);
  if (endedAt == null) return { ok: false, error: "invalid_time" };
  if (endedAt > now) return { ok: false, error: "future" };
  return { ok: true, reservation: row };
}

/** Fin de la clase: `ends_at`, o `starts_at` + duración (default 60 min). Sin inicio válido → null. */
export function classEndMs(row: {
  starts_at: string;
  ends_at?: string | null;
  duration_minutes?: number | null;
}): number | null {
  const start = Date.parse(row.starts_at);
  if (!Number.isFinite(start)) return null;
  const end = row.ends_at ? Date.parse(row.ends_at) : NaN;
  if (Number.isFinite(end) && end >= start) return end;
  const minutes =
    row.duration_minutes != null && Number.isFinite(row.duration_minutes) && row.duration_minutes > 0
      ? row.duration_minutes
      : DEFAULT_CLASS_MINUTES;
  return start + minutes * 60_000;
}

type FoundReservation = VerifiedReservation & {
  cancelled: boolean;
  isWaitlist: boolean;
  ends_at: string | null;
  duration_minutes: number | null;
};

async function findReservation(
  input: {
    apiBaseUrl: string;
    companyId: number;
    token: string;
    brandSlug: string;
    reservationId: number;
    fetchImpl?: FetchLike;
  },
  when: "reservation-past" | "reservation-future",
): Promise<FoundReservation | null> {
  const path = `/me/brand/${encodeURIComponent(input.brandSlug)}/${when}`;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const payload = await gafaAuthedGet(input, path, { page: String(page), per_page: String(PAGE_SIZE) });
    const found = flattenReservations(payload).find((row) => row.reservation_id === input.reservationId);
    if (found) return found;
    const lastPage = laravelLastPage(payload);
    if (!lastPage || page >= lastPage) break;
  }
  return null;
}

export function flattenReservations(payload: unknown): FoundReservation[] {
  return reservationGroups(payload).flatMap((group) => {
    const reservations = asList(group.reservations).map((row) => parseReservation(row, false));
    const waitlists = asList(group.waitlists ?? group.waitlist ?? group.waiting_lists).map((row) =>
      parseReservation(row, true),
    );
    return [...reservations, ...waitlists].filter((row): row is FoundReservation => row != null);
  });
}

function reservationGroups(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    if (payload.length === 0) return [];
    const first = payload[0];
    if (first && typeof first === "object") {
      const row = first as Record<string, unknown>;
      if ("reservations" in row || "waitlists" in row || "waitlist" in row) {
        return payload as Array<Record<string, unknown>>;
      }
      if ("meeting_start" in row || "id" in row) {
        return [{ reservations: payload }];
      }
    }
    return [];
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return reservationGroups(obj.data);
    if ("reservations" in obj || "waitlists" in obj || "waitlist" in obj) return [obj];
  }
  return [];
}

function parseReservation(raw: unknown, forceWaitlist: boolean): FoundReservation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const reservation_id = positiveId(row.id);
  if (!reservation_id) return null;
  const meetings = asRecord(row.meetings);
  const service = asRecord(meetings?.service) ?? asRecord(row.service);
  const staff =
    asRecord(meetings?.substitute_staff) ??
    asRecord(row.substitute_staff) ??
    asRecord(meetings?.staff) ??
    asRecord(row.staff);
  const starts =
    (typeof row.meeting_start === "string" && row.meeting_start) ||
    (typeof meetings?.start === "string" && meetings.start) ||
    (typeof row.start === "string" && row.start) ||
    "";
  const ends =
    (typeof row.meeting_end === "string" && row.meeting_end) ||
    (typeof meetings?.end === "string" && meetings.end) ||
    (typeof row.end === "string" && row.end) ||
    (typeof row.ends_at === "string" && row.ends_at) ||
    "";
  return {
    reservation_id,
    meeting_id: positiveId(meetings?.id) ?? positiveId(row.meetings_id) ?? positiveId(row.meeting_id) ?? null,
    meeting_name:
      readLabel(service?.name) ?? (typeof row.service === "string" ? readLabel(row.service) : null) ?? null,
    staff_id: positiveId(staff?.id) ?? positiveId(row.staff_id) ?? null,
    staff_name: staffLabel(staff),
    starts_at: starts,
    ends_at: ends || null,
    duration_minutes: readDurationMinutes(meetings) ?? readDurationMinutes(service) ?? readDurationMinutes(row),
    cancelled: Boolean(row.cancelled),
    isWaitlist:
      forceWaitlist ||
      row.is_waitlist === true ||
      row.is_waitlist === 1 ||
      row.is_waitlist === "1" ||
      (row.waitlist_number != null && row.waitlist_number !== ""),
  };
}

function staffLabel(staff: Record<string, unknown> | null): string | null {
  if (!staff) return null;
  const nick = readLabel(staff.job) ?? readLabel(staff.apodo);
  if (nick) return nick;
  const name = [staff.name, staff.lastname]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" ")
    .trim();
  return name || null;
}

async function gafaAuthedGet(
  input: { apiBaseUrl: string; companyId: number; token: string; fetchImpl?: FetchLike },
  path: string,
  params: Record<string, string> = {},
): Promise<unknown> {
  const url = new URL(`${input.apiBaseUrl.replace(/\/+$/, "")}/api${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.token}`,
      "GAFAFIT-COMPANY": String(input.companyId),
    },
    signal: AbortSignal.timeout(REQUEST_MS),
  });
  if (!response.ok) {
    const error = new Error(`gafa.fit ${response.status}`);
    (error as { status?: number }).status = response.status;
    throw error;
  }
  return response.json();
}

function laravelLastPage(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const obj = payload as Record<string, unknown>;
  const meta =
    obj.meta && typeof obj.meta === "object" && !Array.isArray(obj.meta)
      ? (obj.meta as Record<string, unknown>)
      : obj;
  const last = Number(meta.last_page ?? obj.last_page);
  return Number.isFinite(last) && last >= 1 ? last : null;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readDurationMinutes(raw: Record<string, unknown> | null): number | null {
  if (!raw) return null;
  const value = raw.duration_minutes ?? raw.durationMinutes ?? raw.duration;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 24 * 60) return null;
  return Math.trunc(n);
}

function positiveId(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

function readLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, 160) : null;
}
