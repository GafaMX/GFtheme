/** Mensaje fijo de F0': métodos de cliente final que Buq Next aún no expone. */
export const BUQ_NEXT_UNAVAILABLE_MESSAGE = "no disponible en Buq Next aún";

export const BUQ_NEXT_UNAVAILABLE_CODE = "BUQ_NEXT_UNAVAILABLE" as const;

/**
 * Error tipado para login, derechos, reserva, compra, wallet y puntos.
 * Los widgets lo pintan como `Error.message`; no tumba el calendario ni el catálogo.
 */
export class BuqNextUnavailableError extends Error {
  readonly code = BUQ_NEXT_UNAVAILABLE_CODE;
  readonly method: string;

  constructor(method: string) {
    super(BUQ_NEXT_UNAVAILABLE_MESSAGE);
    this.name = "BuqNextUnavailableError";
    this.method = method;
  }
}

export function buqNextUnavailable(method: string): never {
  throw new BuqNextUnavailableError(method);
}
