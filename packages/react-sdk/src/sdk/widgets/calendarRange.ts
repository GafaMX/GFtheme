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

/**
 * Día de calendario en la zona de la sede. `toIsoDate` usa el reloj del
 * navegador: 6:00 en Madrid es 22:00 del día anterior en México, y la clase
 * desaparecía del martes si quien mira está en CDMX.
 */
export function toIsoDateInZone(date: Date, timeZone?: string): string {
  if (!timeZone) return toIsoDate(date);
  try {
    const label = date.toLocaleDateString("en-CA", { timeZone });
    if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
  } catch {
    // zona inválida → reloj local
  }
  return toIsoDate(date);
}

/** Día en el que debe pintarse una clase (TZ de la marca si viene). */
export function meetingDateKey(startsAt: string, timeZone?: string): string | null {
  if (!startsAt) return null;
  const date = new Date(startsAt.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    const fallback = startsAt.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(fallback) ? fallback : null;
  }
  return toIsoDateInZone(date, timeZone);
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

/** Lunes como primer dia: el date-picker mensual sigue esa rejilla. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Día de consulta en la zona de la marca (o el reloj local si no hay zona). */
export function todayIsoInZone(now: Date = new Date(), timeZone?: string): string {
  return toIsoDateInZone(now, timeZone);
}

/**
 * Semana = 7 días desde el día de consulta, no lunes–domingo. A mitad de
 * semana el lunes–miércoles ya pasaron y no se reservan (Fitspin / v1).
 * Si el ancla quedó atrás de hoy, la ventana arranca hoy.
 * `today` / `timeZone` evitan que el reloj del navegador pinte un lunes
 * ya cerrado cuando la sede ya está en martes (o al revés).
 */
export function rangeForView(
  anchor: Date,
  view: CalendarView,
  today: Date = new Date(),
  timeZone?: string,
): DateRange {
  if (view === "day") {
    const day = toIsoDate(anchor);
    return { from: day, to: day };
  }

  const todayIso = todayIsoInZone(today, timeZone);
  const startIso = toIsoDate(anchor) < todayIso ? todayIso : toIsoDate(anchor);
  return { from: startIso, to: toIsoDate(addDays(parseIsoDate(startIso), 6)) };
}

/**
 * Si el primer día de la ventana ya terminó (todas las clases Finalizada),
 * la semana arranca al día siguiente y sigue cubriendo 7 días.
 */
export function skipEndedWeekDays(range: DateRange, isEnded: (iso: string) => boolean): DateRange {
  let start = parseIsoDate(range.from);
  for (let i = 0; i < 7; i++) {
    if (!isEnded(toIsoDate(start))) break;
    start = addDays(start, 1);
  }
  return { from: toIsoDate(start), to: toIsoDate(addDays(start, 6)) };
}

/**
 * El `end` de la API de gafa.fit es EXCLUSIVO: pedir start=11 y end=11 devuelve
 * cero reuniones, y start=10&end=16 devuelve solo hasta el 15. Verificado contra
 * produccion. Por eso el rango que se pide no es el mismo que el que se muestra:
 * hay que sumarle un dia al final o se pierde siempre el ultimo dia visible.
 *
 * También pedimos el día anterior. El API guarda `start_date` en
 * America/Mexico_City: 6:00 Madrid del martes queda como 22:00 del lunes.
 * Sin ese colchón el day view del martes no recibe la clase.
 */
export function fetchRangeFor(range: DateRange): DateRange {
  return {
    from: toIsoDate(addDays(parseIsoDate(range.from), -1)),
    to: toIsoDate(addDays(parseIsoDate(range.to), 1)),
  };
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
