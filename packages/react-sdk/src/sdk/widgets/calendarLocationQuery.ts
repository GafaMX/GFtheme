/**
 * Filtro de sede del calendario: la URL (`?location=200`) y
 * `filter-bq-location-default` arrancan el select en esa sede.
 *
 * `undefined` = todavía no eligió (hereda URL/default).
 * `null` = eligió "Todos" a propósito: no volver a caer en la URL.
 */

const LOCATION_QUERY_KEYS = ["location", "location_id", "locationId"] as const;

export function readCalendarLocationIdFromSearch(search: string = ""): number | undefined {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of LOCATION_QUERY_KEYS) {
    const raw = params.get(key);
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function readCalendarLocationIdFromWindow(
  win: { location?: { search?: string } } | undefined = typeof window === "undefined" ? undefined : window,
): number | undefined {
  return readCalendarLocationIdFromSearch(win?.location?.search ?? "");
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
