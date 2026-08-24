import type { Meeting } from "./types";

function spotsLeft(meeting: Meeting): number | undefined {
  const value: unknown = meeting.available;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Clase sin cupo libre (y sin reserva propia que la “abra”). */
export function isSoldOut(meeting: Meeting): boolean {
  if (meeting.isReserved) return false;
  if (meeting.availability === "sold-out" || meeting.availability === "waitlist") return true;
  const available = spotsLeft(meeting);
  if (typeof available === "number") return available <= 0;
  if (typeof meeting.availability === "object" && meeting.availability.capacity) {
    return (meeting.availability.reserved ?? 0) >= meeting.availability.capacity;
  }

  return false;
}

/**
 * Lista de espera visible en el calendario. El listado a veces trae el flag
 * (`is_valid_for_waitlist`); si no, una clase llena se ofrece como waitlist
 * salvo que el API haya dicho explícitamente que no.
 */
export function offersWaitlist(meeting: Meeting): boolean {
  if (meeting.passed || meeting.isReserved) return false;
  if (meeting.availability === "waitlist") return true;
  if (meeting.waitlistAvailable === true) return true;
  if (meeting.waitlistAvailable === false) return false;
  return isSoldOut(meeting);
}

export function getAvailabilityText(meeting: Meeting): string {
  if (meeting.isReserved) return "Ya reservado";
  if (offersWaitlist(meeting)) return "Lista de espera";
  if (typeof meeting.available === "number" && typeof meeting.capacity === "number") {
    return `${meeting.available}/${meeting.capacity} lugares`;
  }
  if (isSoldOut(meeting)) return "Sin lugares";
  return "Disponible";
}

/** Lee el flag de waitlist del JSON crudo del listado o del create-form-template. */
export function readWaitlistAvailable(raw: unknown): boolean | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const value =
    record.is_valid_for_waitlist ??
    record.waitlist_available ??
    record.waitlistAvailable ??
    record.is_waitlist_available;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return undefined;
}

export function availabilityFromCapacity(raw: {
  available?: number | string;
  is_reserved?: number | boolean;
  waitlistAvailable?: boolean;
}): Meeting["availability"] {
  const reserved = Boolean(raw.is_reserved);
  const available =
    typeof raw.available === "number"
      ? raw.available
      : typeof raw.available === "string" && raw.available.trim() !== ""
        ? Number(raw.available)
        : undefined;
  if (typeof available === "number" && Number.isFinite(available) && available <= 0 && !reserved) {
    return raw.waitlistAvailable === false ? "sold-out" : "waitlist";
  }
  return "available";
}

/**
 * Qué puede hacer el socio en una clase llena. El fancy v1 NO deja entrar a
 * waitlist de a gratis: o hay crédito/membresía que aplique (POST reservate,
 * el servidor descuenta y te pone en espera), o hay que comprar y el mismo
 * `/reservate` con `meetings_id` te mete a la lista y resta el crédito nuevo.
 *
 * `waitlistEnabled` sale de `is_valid_for_waitlist` del create-form-template.
 * Si el estudio no tiene waitlist, la clase llena es solo “sin lugares”.
 */
export type FullClassAction = "join-waitlist" | "buy-to-waitlist" | "full" | "none";

export function fullClassAction(opts: {
  soldOut: boolean;
  waitlistEnabled?: boolean;
  hasPaymentOption: boolean;
  contextReady: boolean;
}): FullClassAction {
  if (!opts.soldOut || !opts.contextReady) return "none";
  if (opts.waitlistEnabled) {
    return opts.hasPaymentOption ? "join-waitlist" : "buy-to-waitlist";
  }
  return "full";
}
