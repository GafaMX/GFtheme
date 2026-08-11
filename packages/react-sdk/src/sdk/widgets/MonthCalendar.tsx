import { useMemo, useState } from "react";
import { toIsoDate } from "./calendarRange";

export type MonthCalendarProps = {
  /** Día seleccionado (YYYY-MM-DD). */
  selectedIso?: string;
  /** Mes que se abre cuando no hay día seleccionado. */
  initialMonth?: Date;
  minIso?: string;
  maxIso?: string;
  /** Filtro extra sobre el rango (p. ej. solo días con clases publicadas). */
  isDayEnabled?(iso: string): boolean;
  /** Días a resaltar sin seleccionarlos (p. ej. los que tienen clases). */
  isDayMarked?(iso: string): boolean;
  /**
   * `arrows` para moverse de mes en mes (calendario de clases); `select` cuando
   * la fecha puede estar a décadas de distancia (fecha de nacimiento).
   */
  navigation?: "arrows" | "select";
  onPick(iso: string): void;
};

const WEEKDAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"];

const MONTH_LABELS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("es-MX", { month: "long" }).format(new Date(2020, month, 1)),
);

/**
 * Rejilla mensual compartida (semana de lunes, como los calendarios de los
 * socios). No pinta el marco: cada quien la mete en un popover o en línea.
 */
export function MonthCalendar({
  selectedIso,
  initialMonth,
  minIso = "0000-01-01",
  maxIso = "9999-12-31",
  isDayEnabled,
  isDayMarked,
  navigation = "arrows",
  onPick,
}: MonthCalendarProps) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const base = selectedIso ? parseIso(selectedIso) : (initialMonth ?? new Date());
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const todayIso = toIsoDate(new Date());
  const monthLabel = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(monthCursor);

  const prevMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
  const nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
  const canPrevMonth = toIsoDate(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 0)) >= minIso;
  const canNextMonth = toIsoDate(nextMonth) <= maxIso;

  const years = useMemo(() => {
    const first = Number(minIso.slice(0, 4));
    const last = Number(maxIso.slice(0, 4));
    if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return [];
    // De más reciente a más antiguo: para una fecha de nacimiento se baja poco.
    return Array.from({ length: last - first + 1 }, (_, index) => last - index);
  }, [minIso, maxIso]);

  const cells: Array<Date | null> = [];
  const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const leading = (firstDay.getDay() + 6) % 7;
  for (let i = 0; i < leading; i++) cells.push(null);
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
  }

  return (
    <>
      <div className="gafa-datepicker__header">
        <button
          className="gafa-icon-button"
          type="button"
          disabled={!canPrevMonth}
          onClick={() => setMonthCursor(prevMonth)}
          aria-label="Mes anterior"
        >
          <Chevron direction="left" />
        </button>

        {navigation === "select" ? (
          <div className="gafa-datepicker__selects">
            <select
              aria-label="Mes"
              className="gafa-datepicker__select"
              value={monthCursor.getMonth()}
              onChange={(event) =>
                setMonthCursor(new Date(monthCursor.getFullYear(), Number(event.target.value), 1))
              }
            >
              {MONTH_LABELS.map((label, month) => (
                <option key={label} value={month}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Año"
              className="gafa-datepicker__select"
              value={monthCursor.getFullYear()}
              onChange={(event) => setMonthCursor(new Date(Number(event.target.value), monthCursor.getMonth(), 1))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <strong>{monthLabel}</strong>
        )}

        <button
          className="gafa-icon-button"
          type="button"
          disabled={!canNextMonth}
          onClick={() => setMonthCursor(nextMonth)}
          aria-label="Mes siguiente"
        >
          <Chevron direction="right" />
        </button>
      </div>

      <div className="gafa-datepicker__weekdays" aria-hidden="true">
        {WEEKDAY_HEADERS.map((day, index) => (
          <span key={index}>{day}</span>
        ))}
      </div>

      <div className="gafa-datepicker__grid">
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />;
          const iso = toIsoDate(date);
          const inRange = iso >= minIso && iso <= maxIso;
          const enabled = inRange && (isDayEnabled ? isDayEnabled(iso) : true);

          return (
            <button
              key={iso}
              type="button"
              className="gafa-datepicker__day"
              disabled={!enabled}
              data-selected={iso === selectedIso ? "true" : undefined}
              data-today={iso === todayIso ? "true" : undefined}
              data-has-classes={isDayMarked?.(iso) ? "true" : undefined}
              onClick={() => onPick(iso)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}

function parseIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
