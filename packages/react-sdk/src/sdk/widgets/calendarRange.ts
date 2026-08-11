export type CalendarView = "day" | "week";

export type DateRange = { from: string; to: string };

/**
 * Franjas para filtrar sin pedir nada extra a la API (el rango es por dias).
 * "AM" y no "Mañana" porque "Mañana" se leia como el dia de mañana.
 * Cortes: AM hasta 11:59, Tarde de 12:00 a 16:59, PM de 17:00 en adelante.
 */
export type TimeOfDay = "all" | "am" | "tarde" | "pm";

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  all: "Todos",
  am: "AM",
  tarde: "Tarde",
  pm: "PM",
};

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Lunes como primer dia: es lo que usan los calendarios de los socios. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Rango que hay que pedir para la ventana visible, y solo para esa. Antes se
 * pedia `calendar_days` entero (21 dias en Bunker) aunque en pantalla solo
 * cupieran unos pocos.
 */
export function rangeForView(anchor: Date, view: CalendarView): DateRange {
  if (view === "day") {
    const day = toIsoDate(anchor);
    return { from: day, to: day };
  }

  const start = startOfWeek(anchor);
  return { from: toIsoDate(start), to: toIsoDate(addDays(start, 6)) };
}

/**
 * El `end` de la API de gafa.fit es EXCLUSIVO: pedir start=11 y end=11 devuelve
 * cero reuniones, y start=10&end=16 devuelve solo hasta el 15. Verificado contra
 * produccion. Por eso el rango que se pide no es el mismo que el que se muestra:
 * hay que sumarle un dia al final o se pierde siempre el ultimo dia visible.
 */
export function fetchRangeFor(range: DateRange): DateRange {
  return { from: range.from, to: toIsoDate(addDays(parseIsoDate(range.to), 1)) };
}

export function shiftAnchor(anchor: Date, view: CalendarView, direction: 1 | -1): Date {
  return addDays(anchor, view === "day" ? direction : direction * 7);
}

export function daysInRange(range: DateRange): Date[] {
  const days: Date[] = [];
  const start = parseIsoDate(range.from);
  const end = parseIsoDate(range.to);

  for (let date = start; date <= end; date = addDays(date, 1)) {
    days.push(new Date(date));
  }

  return days;
}

export function timeOfDayFor(startsAt: string, timeZone?: string): Exclude<TimeOfDay, "all"> | null {
  const date = new Date(startsAt.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return null;

  const hour = hourIn(date, timeZone);
  if (hour >= 0 && hour < 12) return "am";
  if (hour >= 12 && hour < 17) return "tarde";
  if (hour >= 17 && hour < 24) return "pm";
  return null;
}

export function matchesTimeOfDay(startsAt: string, timeOfDay: TimeOfDay, timeZone?: string): boolean {
  if (timeOfDay === "all") return true;
  return timeOfDayFor(startsAt, timeZone) === timeOfDay;
}

/**
 * La franja se decide con la hora de la SEDE, igual que la hora que se pinta en
 * la tarjeta: una clase de las 8am de Ciudad de Mexico es "mañana" aunque quien
 * mira este en otra zona horaria.
 */
function hourIn(date: Date, timeZone?: string): number {
  if (!timeZone) return date.getHours();

  try {
    const label = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone }).format(date);
    const hour = Number(label);
    // Algunos motores devuelven "24" para medianoche.
    return Number.isNaN(hour) ? date.getHours() : hour % 24;
  } catch {
    return date.getHours();
  }
}

export function isSameDay(a: Date, b: Date): boolean {
  return toIsoDate(a) === toIsoDate(b);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
