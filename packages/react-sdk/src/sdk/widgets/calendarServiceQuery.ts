/**
 * Filtro de servicio del calendario: la URL y `filter-bq-service-default`
 * arrancan el select en ese servicio.
 *
 * V2 canónico: `?service=123` (también `service_id`, `serviceId`).
 * V1: `?filter_service=Pilates+Reformer` (nombre) o el mismo key con id.
 *
 * `undefined` = todavía no eligió (hereda URL/default).
 * `null` = eligió "Todos" a propósito: no volver a caer en la URL.
 */

const SERVICE_QUERY_KEYS = ["service", "service_id", "serviceId", "filter_service"] as const;

export type CalendarServiceQuery = {
  serviceId?: number;
  serviceName?: string;
};

export function readCalendarServiceQueryFromSearch(search: string = ""): CalendarServiceQuery {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of SERVICE_QUERY_KEYS) {
    const raw = params.get(key);
    if (!raw) continue;
    const parsed = parseCalendarServiceDefault(raw);
    if (parsed.serviceId != null || parsed.serviceName) return parsed;
  }
  return {};
}

export function readCalendarServiceQueryFromWindow(
  win: { location?: { search?: string } } | undefined = typeof window === "undefined" ? undefined : window,
): CalendarServiceQuery {
  return readCalendarServiceQueryFromSearch(win?.location?.search ?? "");
}

export function parseCalendarServiceDefault(value: string | null | undefined): CalendarServiceQuery {
  if (value == null) return {};
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed) && trimmed !== "") return { serviceId: parsed };
  return { serviceName: trimmed };
}

/**
 * URL gana sobre el atributo HTML. Un id en la URL ignora el default del markup.
 */
export function resolveCalendarServiceQuery(
  search: string = "",
  attributeDefault?: string | null,
): CalendarServiceQuery {
  const fromUrl = readCalendarServiceQueryFromSearch(search);
  if (fromUrl.serviceId != null || fromUrl.serviceName) return fromUrl;
  return parseCalendarServiceDefault(attributeDefault);
}

/**
 * Servicio efectivo para pedir meetings y pintar el select.
 * `null` gana: es "Todos" y no se reaplica el default de la URL.
 */
export function resolveCalendarServiceId(
  selected: number | null | undefined,
  fallback?: number,
): number | undefined {
  if (selected === null) return undefined;
  return selected ?? fallback;
}

export function normalizeServiceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function serviceNamesMatch(left?: string | null, right?: string | null): boolean {
  if (!left || !right) return false;
  return normalizeServiceName(left) === normalizeServiceName(right);
}

export function matchServiceIdByName(
  name: string | undefined,
  services: Array<{ id: number; name: string }>,
): number | undefined {
  if (!name) return undefined;
  const match = services.find((service) => serviceNamesMatch(service.name, name));
  return match?.id;
}

export function meetingMatchesService(
  meeting: {
    service?: { id?: number; name?: string } | null;
    serviceId?: string | number;
    serviceName?: string;
  },
  filter: { serviceId?: number; serviceName?: string },
): boolean {
  if (filter.serviceId != null) {
    const id = meeting.service?.id ?? (meeting.serviceId != null ? Number(meeting.serviceId) : undefined);
    return id === filter.serviceId;
  }
  if (filter.serviceName) {
    const name = meeting.service?.name ?? meeting.serviceName;
    return serviceNamesMatch(name, filter.serviceName);
  }
  return true;
}
