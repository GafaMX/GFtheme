/**
 * GafaPay ya cobró; `/reservate` es solo el registro en Buq.
 * Un 500/timeout no debe dejar la compra Pendiente sin reintento.
 * Nunca dispara un segundo cargo: el caller no vuelve a GafaPay.
 */

export const RESERVATE_MAX_ATTEMPTS = 3;
/** Espera después del 1.er y 2.º fallo (intento 3 falla y listo). */
export const RESERVATE_BACKOFF_MS = [1000, 2000] as const;

/** Tests lo sustituyen para no esperar de verdad. */
export const reservateRetryWait = {
  wait: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

export async function retryReservate<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RESERVATE_MAX_ATTEMPTS; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const delay = RESERVATE_BACKOFF_MS[attempt];
      if (delay == null) break;
      await reservateRetryWait.wait(delay);
    }
  }
  throw lastError;
}
