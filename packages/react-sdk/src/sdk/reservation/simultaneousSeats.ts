import type { ReservationPaymentOption, SeatMapObject } from "../client/types";

export type InvitedGuest = {
  name: string;
  email: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Tope de lugares por reserva. Default 1 (una silla, como siempre). */
export function readSimultaneousReservations(raw: unknown): number {
  let value = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
  }
  const location = asRecord(value);
  const brand = asRecord(location?.brand) ?? location;
  const n = Number(brand?.simultaneous_reservations ?? brand?.simultaneousReservations ?? 1);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Clic en el mapa: agrega, quita, o suelta el más viejo al pasar el tope (FIFO V1). */
export function toggleSeatSelection(
  selected: SeatMapObject[],
  seat: SeatMapObject,
  limit: number,
): SeatMapObject[] {
  const cap = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : 1;
  if (selected.some((item) => item.id === seat.id)) {
    return selected.filter((item) => item.id !== seat.id);
  }
  const next = [...selected, seat];
  if (next.length <= cap) return next;
  return next.slice(next.length - cap);
}

export function resolveSeatObjectIds(payload: {
  seatObjectId?: number;
  seatObjectIds?: number[];
}): number[] {
  if (Array.isArray(payload.seatObjectIds) && payload.seatObjectIds.length > 0) {
    return payload.seatObjectIds.filter((id) => Number.isFinite(id));
  }
  return payload.seatObjectId != null && Number.isFinite(payload.seatObjectId)
    ? [payload.seatObjectId]
    : [];
}

/** Índice V1: el 0 es el anfitrión; invitados desde 1. Vacío no se manda. */
export function buildInvitedData(
  guests: Record<number, InvitedGuest>,
): Record<string, InvitedGuest> | undefined {
  const out: Record<string, InvitedGuest> = {};
  for (const [key, guest] of Object.entries(guests)) {
    const name = guest.name.trim();
    const email = guest.email.trim();
    if (!name && !email) continue;
    out[key] = { name, email };
  }
  return Object.keys(out).length ? out : undefined;
}

export function isGuestEmailOk(email: string): boolean {
  const value = email.trim();
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function guestsHaveInvalidEmail(guests: Record<number, InvitedGuest>): boolean {
  return Object.values(guests).some((guest) => !isGuestEmailOk(guest.email));
}

/**
 * Con más de un lugar solo cuentan paquetes con créditos suficientes.
 * Una silla sigue aceptando membresía.
 */
export function paymentOptionsForSeats(
  options: ReservationPaymentOption[],
  seatCount: number,
): ReservationPaymentOption[] {
  const n = Math.max(1, seatCount);
  if (n <= 1) return options;
  return options.filter((option) => option.kind === "credit" && (option.remaining ?? 0) >= n);
}

export function canReserveWithCredits(
  options: ReservationPaymentOption[],
  seatCount: number,
): boolean {
  return paymentOptionsForSeats(options, seatCount).some((option) => option.kind === "credit");
}

export function formatSeatLabels(labels: string[]): string {
  const clean = labels.map((label) => label.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} y ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} y ${clean[clean.length - 1]}`;
}

/** Paquete de 1 crédito para prefijar cantidad = lugares. */
export function findOneCreditCombo<T extends { credits?: number }>(combos: T[]): T | undefined {
  return combos.find((combo) => combo.credits === 1);
}
