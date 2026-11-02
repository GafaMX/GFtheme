/**
 * Tope de unidades en el carrito. gafa.fit no manda `one_time`: el combo /
 * membresía trae `reservations_max` (y a veces `reservations_min`).
 * `reservations_max === 1` = solo se puede comprar una vez.
 * null / 0 / ausente = sin tope.
 */
export function readPositiveInt(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

export function purchaseAmountCap(source?: {
  reservationsMax?: number | null;
  raw?: Record<string, unknown> | null;
} | null): number | undefined {
  const fromRaw = readPositiveInt(source?.raw?.reservations_max);
  if (fromRaw != null) return fromRaw;
  return readPositiveInt(source?.reservationsMax);
}

export function clampPurchaseAmount(amount: number, cap: number | undefined): number {
  const next = Math.max(0, Math.floor(amount));
  if (cap == null) return next;
  return Math.min(next, cap);
}
