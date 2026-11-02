/**
 * `reservations_max` (combo/membresía en gafa.fit) es el máximo de UNIDADES
 * que un usuario puede tener en total, sumando todas sus compras: con 3
 * puede llevar 3 de una, o 1+2, nunca más de 3.
 *
 * El JSON del catálogo no trae cuántas ya compró. El carrito capea en
 * `reservations_max`; canBuy / ProfileTrait en gafa.fit aplica el resto.
 *
 * `1` → una sola unidad en el carrito (se ocultan +/-).
 * Entero > 1 → tope de cantidad; se desactiva + al llegar.
 * `null` / ausente → sin tope en el carrito.
 * `0` en el backend BLOQUEA el paquete (no es “sin tope”). Aquí no se
 * bloquea la línea: userPosibilities ya lo saca del catálogo.
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

/**
 * Un `raw` nuevo incompleto no debe borrar `reservations_max` que ya
 * estaba en la línea del carrito.
 */
export function mergeCartRaw(
  incoming?: Record<string, unknown> | null,
  existing?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (!incoming && !existing) return undefined;
  if (!incoming) return existing ?? undefined;
  if (!existing) return incoming;
  const merged = { ...existing, ...incoming };
  if (purchaseAmountCap({ raw: incoming }) == null && purchaseAmountCap({ raw: existing }) != null) {
    merged.reservations_max = existing.reservations_max;
  }
  return merged;
}
