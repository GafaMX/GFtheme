/**
 * El listado de clases a veces ya dice si hay mapa de salón. Lo leemos de
 * varios nombres que ha usado gafa.fit (`maps_id`, `has_map`, `room.map`…)
 * para abrir el modal ancho SOLO cuando hay mapa, y el sencillo cuando no.
 */

function hasOwn(raw: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(raw, key);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false" || value === null) return false;
  return undefined;
}

function positiveId(value: unknown): boolean {
  if (value == null || value === "" || value === false) return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function mapValueMeansSeatMap(value: unknown): boolean {
  if (value == null || value === false || value === "") return false;
  if (typeof value === "number" || typeof value === "string") return positiveId(value);
  const record = asRecord(value);
  if (!record) return false;
  if (Array.isArray(record.objects)) return record.objects.length > 0;
  if (hasOwn(record, "id")) return positiveId(record.id);
  return Object.keys(record).length > 0;
}

const BOOL_KEYS = ["has_map", "hasMap", "has_seat_map", "hasSeatMap", "with_map", "withMap"] as const;
const ID_KEYS = ["maps_id", "map_id", "mapsId", "mapId"] as const;

/**
 * `true` / `false` si el payload lo deja claro; `undefined` si no hay pista
 * (entonces no conviene abrir el modal ancho “por si acaso”).
 */
export function readHasSeatMap(raw: unknown): boolean | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;

  for (const key of BOOL_KEYS) {
    if (hasOwn(record, key)) {
      const parsed = toBool(record[key]);
      if (parsed != null) return parsed;
    }
  }

  for (const key of ID_KEYS) {
    if (hasOwn(record, key)) return positiveId(record[key]);
  }

  if (hasOwn(record, "map")) return mapValueMeansSeatMap(record.map);

  if (record.room != null) {
    const nested = readHasSeatMap(record.room);
    if (nested != null) return nested;
  }

  return undefined;
}

/** El sheet ancho (info + mapa) solo si ya hay mapa o el listado prometió uno. */
export function reservationShowsSeatMapLayout(opts: {
  hasSeatMap?: boolean;
  hasLoadedSeatMap: boolean;
  contextLoading: boolean;
}): boolean {
  if (opts.hasLoadedSeatMap) return true;
  return Boolean(opts.contextLoading && opts.hasSeatMap === true);
}
