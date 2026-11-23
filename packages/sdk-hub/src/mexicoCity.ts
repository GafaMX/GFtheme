/** Días del admin de calificaciones: calendario de CDMX, no UTC. */

export const ADMIN_TIME_ZONE = "America/Mexico_City";

export function dayStartInZone(value: string, timeZone = ADMIN_TIME_ZONE): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(zonedWallToUtcMs(value, 0, 0, 0, 0, timeZone)).toISOString();
}

export function dayEndInZone(value: string, timeZone = ADMIN_TIME_ZONE): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(zonedWallToUtcMs(value, 23, 59, 59, 999, timeZone)).toISOString();
}

export function zonedWallToUtcMs(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): number {
  const [year, month, day] = ymd.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = Date.UTC(year, month - 1, day, 6, 0, 0);
  for (let i = 0; i < 12; i += 1) {
    const actual = wallAsUtcNumber(wallParts(utc, timeZone));
    const delta = desired - actual;
    if (delta === 0) return utc + ms;
    utc += delta;
  }
  return utc + ms;
}

function wallParts(ms: number, timeZone: string) {
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms))) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function wallAsUtcNumber(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}
