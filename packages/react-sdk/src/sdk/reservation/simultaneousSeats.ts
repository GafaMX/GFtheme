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

/**
 * Paquetes de agregadores / uso interno: nunca se prefijan para invitados
 * (FITPASS $0, walk in GYMPASS, TotalPass, Wellhub, ClassPass).
 */
const NON_GUEST_PACKAGE = /\b(fitpass|gympass|wellhub|totalpass|total\s*pass|classpass|class\s*pass|walk[\s-]?in)\b/i;

type GuestComboCandidate = {
  credits?: number;
  name?: string;
  price?: number;
  priceFinal?: number;
  subscribable?: boolean;
  raw?: Record<string, unknown>;
};

/** Un paquete de 1 crédito, con precio > 0, visible y que no sea de agregador. */
export function isEligibleGuestCombo(combo: GuestComboCandidate): boolean {
  if (combo.credits !== 1) return false;
  const price = combo.priceFinal ?? combo.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return false;
  if (combo.raw?.hide_in_front) return false;
  if (NON_GUEST_PACKAGE.test(combo.name ?? "")) return false;
  return true;
}

/**
 * Paquete de 1 crédito para prefijar cantidad = lugares.
 *
 * `combos` TIENE que ser la lista del fancy anclado a la clase
 * (`combosSelection` de create-form-template con `meetings_id`), nunca el
 * catálogo de la marca: el catálogo mezcla disciplinas (p. ej. Fuerza en una
 * clase de Bici). Si no hay un paquete válido se regresa `undefined` y el
 * checkout muestra un aviso en lugar de elegir uno.
 */
export function findOneCreditCombo<T extends GuestComboCandidate>(combos: T[]): T | undefined {
  return combos.find(isEligibleGuestCombo);
}

/**
 * Invitados por índice V1 (0 = anfitrión). Al cambiar la selección del mapa
 * los datos siguen a su LUGAR (por id), no a la posición: si un lugar se
 * quita, sale del FIFO o pasa a ser el del anfitrión, sus datos se descartan.
 */
export function remapGuestsForSeats(
  previousSeats: SeatMapObject[],
  nextSeats: SeatMapObject[],
  guests: Record<number, InvitedGuest>,
): Record<number, InvitedGuest> {
  const bySeatId = new Map<number, InvitedGuest>();
  previousSeats.forEach((seat, index) => {
    if (index === 0) return;
    const guest = guests[index];
    if (guest) bySeatId.set(seat.id, guest);
  });
  const out: Record<number, InvitedGuest> = {};
  nextSeats.forEach((seat, index) => {
    if (index === 0) return;
    const guest = bySeatId.get(seat.id);
    if (guest) out[index] = guest;
  });
  return out;
}

/**
 * `selected_credit` para `/reservate`. Se manda SIEMPRE que haya una opción
 * activa (aunque sea la única): sin él gafa.fit elige solo, membresía primero
 * y luego el primer crédito válido, que puede no ser el paquete que el
 * usuario vio (p. ej. uno de 1 crédito o de agregador) en una reserva de
 * varios lugares.
 */
export function selectedCreditForReservation(
  activeOption: ReservationPaymentOption | null | undefined,
  paymentOptions: ReservationPaymentOption[],
): string | undefined {
  if (!activeOption) return undefined;
  return paymentOptions.some((option) => option.id === activeOption.id) ? activeOption.id : undefined;
}
