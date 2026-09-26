/**
 * Filtro de sede del calendario: la URL y `filter-bq-location-default`
 * arrancan el select en esa sede.
 *
 * V2 canónico: `?location=200` (también `location_id`, `locationId`).
 * V1: `?filter_location=San+Jose+Insurgentes` (nombre). Los WP de Buq
 * copian ese query a `filter-bq-location-default`.
 *
 * `undefined` = todavía no eligió (hereda URL/default).
 * `null` = eligió "Todos" a propósito: no volver a caer en la URL.
 */

const LOCATION_QUERY_KEYS = ["location", "location_id", "locationId", "filter_location"] as const;

export type CalendarLocationQuery = {
  locationId?: number;
  locationName?: string;
};

export function parseCalendarLocationDefault(value: string | null | undefined): CalendarLocationQuery {
  if (value == null) return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed) && /^\d+$/.test(trimmed)) return { locationId: parsed };
  return { locationName: trimmed };
}

export function readCalendarLocationQueryFromSearch(search: string = ""): CalendarLocationQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of LOCATION_QUERY_KEYS) {
    const raw = params.get(key);
    if (!raw) continue;
    const parsed = parseCalendarLocationDefault(raw);
    if (parsed.locationId != null || parsed.locationName) return parsed;
  }
  return {};
}

export function readCalendarLocationQueryFromWindow(
  win: { location?: { search?: string } } | undefined = typeof window === "undefined" ? undefined : window,
): CalendarLocationQuery {
  return readCalendarLocationQueryFromSearch(win?.location?.search ?? "");
}

/** @deprecated Prefer `readCalendarLocationQueryFromSearch`. */
export function readCalendarLocationIdFromSearch(search: string = ""): number | undefined {
  return readCalendarLocationQueryFromSearch(search).locationId;
}

export function readCalendarLocationIdFromWindow(
  win: { location?: { search?: string } } | undefined = typeof window === "undefined" ? undefined : window,
): number | undefined {
  return readCalendarLocationQueryFromWindow(win).locationId;
}

/**
 * URL gana sobre el atributo HTML. Un id en la URL ignora el default del markup.
 */
export function resolveCalendarLocationQuery(
  search: string = "",
  attributeDefault?: string | null,
): CalendarLocationQuery {
  const fromUrl = readCalendarLocationQueryFromSearch(search);
  if (fromUrl.locationId != null || fromUrl.locationName) return fromUrl;
  return parseCalendarLocationDefault(attributeDefault);
}

/**
 * Sede efectiva para pedir meetings y pintar el select.
 * `null` gana: es "Todos" y no se reaplica el default de la URL.
 */
export function resolveCalendarLocationId(
  selected: number | null | undefined,
  fallback?: number,
): number | undefined {
  if (selected === null) return undefined;
  return selected ?? fallback;
}

/** Valor del <select>: "" pinta "Todos". */
export function calendarLocationSelectValue(
  selected: number | null | undefined,
  fallback?: number,
): string {
  const id = resolveCalendarLocationId(selected, fallback);
  return id == null ? "" : String(id);
}

export function normalizeLocationToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function locationTokensMatch(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  return normalizeLocationToken(left) === normalizeLocationToken(right);
}

export function matchLocation<T extends { id: number; name: string; slug?: string }>(
  query: CalendarLocationQuery,
  locations: T[],
): T | undefined {
  if (query.locationId != null) {
    const byId = locations.find((location) => Number(location.id) === Number(query.locationId));
    if (byId) return byId;
  }
  if (!query.locationName) return undefined;
  return locations.find(
    (location) =>
      locationTokensMatch(location.name, query.locationName) ||
      locationTokensMatch(location.slug, query.locationName),
  );
}
