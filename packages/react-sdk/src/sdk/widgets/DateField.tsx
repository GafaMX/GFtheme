import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { toIsoDate } from "./calendarRange";
import { MonthCalendar } from "./MonthCalendar";

export type DateFieldMode = "birth" | "date";

export type DateFieldProps = {
  label: string;
  value: string;
  onChange(value: string): void;
  name?: string;
  required?: boolean;
  error?: string;
  helpText?: string | null;
  /**
   * `birth`: solo pasado, atajo a elegir año.
   * `date`: el mismo widget, con años hacia adelante (campos especiales).
   */
  mode?: DateFieldMode;
};

function yearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return toIsoDate(date);
}

function yearsAhead(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return toIsoDate(date);
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function copySdkSkin(from: Element | null): { scheme: string; style?: CSSProperties } {
  const scheme = from?.getAttribute("data-color-scheme") ?? "dark";
  if (!(from instanceof HTMLElement) || from.style.length === 0) {
    return { scheme };
  }
  const style: Record<string, string> = {};
  for (const prop of from.style) {
    style[prop] = from.style.getPropertyValue(prop);
  }
  return { scheme, style: style as CSSProperties };
}

/**
 * Campo de fecha con el calendario mensual del SDK. No usamos
 * `input[type=date]`: el nativo cambia por OS, no respeta el tema y tapa el
 * formulario.
 *
 * El popup SIEMPRE va a `document.body`. El fancy de reserva y Mi cuenta
 * recortan overflow; Elementor a veces pone `transform` en un ancestro y
 * entonces `position:fixed` dentro de `.gafa-sdk` se va fuera de pantalla.
 */
export function DateField({
  label,
  value,
  onChange,
  name,
  required,
  error,
  helpText,
  mode = "date",
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(
    null,
  );
  const [skin, setSkin] = useState<{ scheme: string; style?: CSSProperties }>({ scheme: "dark" });

  const maxIso = mode === "birth" ? toIsoDate(new Date()) : yearsAhead(5);
  const minIso = yearsAgo(120);
  const popoverWidth = 272;

  useLayoutEffect(() => {
    if (!open) return;
    setSkin(copySdkSkin(buttonRef.current?.closest(".gafa-sdk") ?? null));

    const reposition = () => {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const left = Math.min(Math.max(anchor.left, 12), window.innerWidth - popoverWidth - 12);
      const spaceBelow = window.innerHeight - anchor.bottom;
      const openUpward = spaceBelow < 320 && anchor.top > spaceBelow;
      setRect({
        top: openUpward ? undefined : anchor.bottom + 6,
        bottom: openUpward ? window.innerHeight - anchor.top + 6 : undefined,
        left,
        width: popoverWidth,
      });
    };

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="gafa-acct-datefield" data-invalid={error ? "true" : undefined}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        ref={buttonRef}
        className="gafa-acct-datefield__button"
        type="button"
        aria-expanded={open}
        aria-required={required || undefined}
        data-filled={value ? "true" : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="gafa-acct-datefield__label">{label}</span>
        <span className="gafa-acct-datefield__value">{value ? formatDate(value) : "Elegir fecha"}</span>
        <CalendarGlyph />
      </button>
      {helpText ? <span className="gafa-sdk-field-help">{helpText}</span> : null}

      {open && rect && typeof document !== "undefined"
        ? createPortal(
            <div className="gafa-sdk gafa-datepicker-host" data-color-scheme={skin.scheme} style={skin.style}>
              <div
                ref={popoverRef}
                className="gafa-datepicker gafa-datepicker--floating"
                style={{ top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width }}
              >
                <MonthCalendar
                  selectedIso={value || undefined}
                  initialMonth={
                    value ? undefined : mode === "birth" ? new Date(new Date().getFullYear() - 25, 0, 1) : new Date()
                  }
                  minIso={minIso}
                  maxIso={maxIso}
                  navigation="select"
                  onPick={(iso) => {
                    onChange(iso);
                    setOpen(false);
                  }}
                />
                <div className="gafa-datepicker__footer">
                  <button
                    type="button"
                    className="gafa-acct-link"
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    Limpiar
                  </button>
                  <button type="button" className="gafa-acct-link" onClick={() => setOpen(false)}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function isDateFieldType(type: string): boolean {
  const normalized = type.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return (
    normalized === "date" ||
    normalized === "datetime" ||
    normalized === "datetimelocal" ||
    normalized === "birthdate" ||
    normalized === "birthday" ||
    normalized === "datepicker" ||
    normalized === "calendar"
  );
}

export function isBirthDateField(name: string, type: string): boolean {
  if (/birth|cumplea|nacimiento/.test(`${name} ${type}`.toLowerCase())) return true;
  return type.trim().toLowerCase().replace(/[\s_-]+/g, "") === "birthdate";
}
