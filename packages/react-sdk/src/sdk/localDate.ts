/**
 * Fechas de calendario en la zona del navegador. `toISOString().slice(0, 10)`
 * es UTC: en México, después de las 18:00, “hoy” en UTC ya es mañana y el
 * listado de clases (y getMeeting) se salta el día que el calendario muestra.
 */

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
