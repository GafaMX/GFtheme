import type { CartLine } from "./cartStore";

/** Errores locales que no dicen nada del producto (sesión, red, config). */
const TRANSIENT = /failed to fetch|networkerror|load failed|typeerror|timeout|recarga e inténtalo|no pudimos revisar/i;

/**
 * ¿Buq rechazó la compra por una regla del producto (uso restringido, tope,
 * membresía repetida…)? Solo en ese caso tiene sentido sacar la línea del
 * carrito. Un 401/419/429/5xx o un fallo de red NO es culpa del producto.
 */
export function isEligibilityRejection(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number") {
    if (status === 401 || status === 419 || status === 429) return false;
    if (status < 400 || status >= 500) return false;
  }
  const text = err.message.replace(/\s+/g, " ").trim();
  if (!text) return false;
  return !TRANSIENT.test(text);
}

/**
 * Revisa línea por línea cuáles rechaza Buq. Con una sola línea no hace falta
 * volver a preguntar: el rechazo ya es de ella. Devuelve las líneas malas y el
 * primer mensaje de rechazo. Si una revisión individual falla por red, esa
 * línea se conserva (no se borra algo por un fallo transitorio).
 */
export async function findIneligibleLines(
  lines: CartLine[],
  firstError: unknown,
  check: (line: CartLine) => Promise<void>,
): Promise<{ bad: CartLine[]; error: unknown }> {
  if (lines.length <= 1) return { bad: [...lines], error: firstError };
  const bad: CartLine[] = [];
  let error: unknown = firstError;
  for (const line of lines) {
    try {
      await check(line);
    } catch (err) {
      if (isEligibilityRejection(err)) {
        if (!bad.length) error = err;
        bad.push(line);
      }
    }
  }
  return { bad, error };
}
