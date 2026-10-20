/**
 * GafaPay/Stripe mandan códigos (ERROR-05), inglés y el nombre del proveedor.
 * El cliente final solo necesita la causa.
 */
export function humanizeCheckoutError(raw?: string | null): string {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "No pudimos completar el pago. Inténtalo de nuevo.";

  if (/ya fue cobrada/i.test(text)) return text;

  if (
    /runtime de pago|no se pudo preparar|gafapay carg[oó] pero|unpkg|reactdom|react 16/i.test(text)
  ) {
    return "No se pudo cargar el formulario de pago. Inténtalo de nuevo.";
  }

  if (/formulario de pago no carg|no se pudo conectar con gafapay|procesador de pago aún no está listo/i.test(text)) {
    return /procesador de pago aún no está listo/i.test(text)
      ? text
      : "No se pudo cargar el formulario de pago. Inténtalo de nuevo.";
  }

  if (/security code|incorrect_cvc|invalid cvc|\bcvc\b|\bcvv\b|c[oó]digo de seguridad/i.test(text)) {
    return "Código de seguridad inválido.";
  }
  if (/card number|invalid number|n[uú]mero de tarjeta|incorrect_number/i.test(text)) {
    return "El número de tarjeta no es válido.";
  }
  if (/expir|invalid_expiry|fecha de (la )?tarjeta/i.test(text)) {
    return "La fecha de la tarjeta no es válida.";
  }
  if (/insufficient|fondos suficientes|insufficient_funds/i.test(text)) {
    return "La tarjeta no tiene fondos suficientes.";
  }
  if (/declined|rechazad|card_declined/i.test(text)) {
    return "La tarjeta fue rechazada. Prueba con otra.";
  }
  if (/zip|postal/i.test(text) && /invalid/i.test(text)) {
    return "El código postal no es válido.";
  }

  if (/no pudimos abrir paypal/i.test(text)) return "No pudimos abrir PayPal. Intenta de nuevo.";
  if (/no pudimos abrir el pago/i.test(text)) return text;
  if (/el formulario de pago todavía no está listo/i.test(text)) return text;
  if (/acepta los t[eé]rminos|agrega un paquete/i.test(text)) return text;

  const stripped = text
    .replace(/^ocurri[oó] un error al completar el pago( con \w+)?\.?\s*/i, "")
    .replace(/ERROR-\d+:\s*/gi, "")
    .replace(/no se pudo crear la tarjeta\.?\s*/i, "")
    .replace(/\b(stripe|conekta|gafapay|paypal)\b:?\s*/gi, "")
    .trim();

  if (stripped && stripped !== text) return humanizeCheckoutError(stripped);

  if (text.length <= 90 && !/ERROR-\d+|unpkg|TypeError|undefined/i.test(text)) return text;
  return "No pudimos completar el pago. Inténtalo de nuevo.";
}
