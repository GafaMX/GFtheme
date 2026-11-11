/**
 * Preflight de `/reservate?test=true` en el paso de pago.
 * Si Buq no contesta, el formulario no se queda en skeleton.
 */

export const PREVIEW_PURCHASE_TIMEOUT_MS = 8_000;

export const PREVIEW_PURCHASE_TIMEOUT_MESSAGE =
  "No pudimos revisar tu compra a tiempo. Inténtalo de nuevo.";

export class PreviewTimeoutError extends Error {
  override name = "PreviewTimeoutError";
  constructor(message = PREVIEW_PURCHASE_TIMEOUT_MESSAGE) {
    super(message);
  }
}

let timeoutMsForTests: number | null = null;

export function previewPurchaseTimeoutMs(): number {
  return timeoutMsForTests ?? PREVIEW_PURCHASE_TIMEOUT_MS;
}

export function setPreviewPurchaseTimeoutMsForTests(ms: number | null): void {
  timeoutMsForTests = ms;
}

export function withTimeout<T>(promise: Promise<T>, ms: number = previewPurchaseTimeoutMs()): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new PreviewTimeoutError());
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function isPreviewTimeoutError(error: unknown): error is PreviewTimeoutError {
  return error instanceof PreviewTimeoutError || (error instanceof Error && error.name === "PreviewTimeoutError");
}
