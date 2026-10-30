/**
 * Cuerpo `application/x-www-form-urlencoded` con objetos y arrays anidados al
 * estilo PHP, igual que el `$.param()` de jQuery que usa el fancy v1:
 * `payment_data[card][id]=tok_123`.
 *
 * gafa.fit lee `payment_data` como array. Si un objeto anidado viaja como JSON
 * (`payment_data[card]={"id":"tok_123"}`), Laravel recibe un string, no puede
 * conciliar el cobro y la compra se queda en "Checkout no resuelto": el cargo
 * ya está hecho en Stripe pero no se otorgan créditos.
 */
export function toFormBody(body: Record<string, unknown>): URLSearchParams {
  const form = new URLSearchParams();
  Object.entries(body).forEach(([key, value]) => appendFormValue(form, key, value));
  return form;
}

function appendFormValue(form: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => appendFormValue(form, `${key}[${index}]`, item));
    return;
  }

  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
      appendFormValue(form, `${key}[${childKey}]`, childValue);
    });
    return;
  }

  form.set(key, String(value));
}
