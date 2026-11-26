import type { CartLine } from "./cartStore";

export type MembershipPayToggles = {
  saveCard: boolean;
  autoRenew: boolean;
};

const TRUTHY = new Set(["1", "true", "yes", "on"]);
const FALSY = new Set(["0", "false", "off", "no"]);

/** true/false si el valor se entiende; si no, undefined. */
export function coerceFlag(value: unknown): boolean | undefined {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "") return true;
    if (TRUTHY.has(normalized)) return true;
    if (FALSY.has(normalized)) return false;
  }
  return undefined;
}

/**
 * Las opciones de membresía (link + checks) van ocultas. Se muestran si el
 * socio lo pide en el embed, en el shortcode o por CSS.
 *
 * - `data-gf-options`: `{ "SHOW_MEMBERSHIP_OPTIONS": true }`
 * - atributo: `show-membership-options` / `data-gafa-membership-options`
 * - CSS: `.gafa-checkout-membership { display: grid !important; }`
 */
export function readShowMembershipOptions(
  root?: ParentNode | null,
  explicit?: boolean,
): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  const scope = root ?? (typeof document === "undefined" ? null : document);
  if (!scope) return false;

  const hosts = scope.querySelectorAll<HTMLElement>(
    "[data-gafa-membership-options], [show-membership-options]",
  );
  for (const host of hosts) {
    const raw =
      host.getAttribute("data-gafa-membership-options") ?? host.getAttribute("show-membership-options");
    if (coerceFlag(raw) === true) return true;
  }

  const script =
    scope.querySelector("[data-gafa-options]") ?? scope.querySelector("[data-gf-options]");
  const json = script?.textContent?.trim();
  if (!json) return false;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return (
      coerceFlag(parsed.SHOW_MEMBERSHIP_OPTIONS ?? parsed.showMembershipOptions) === true
    );
  } catch {
    return false;
  }
}

export function cartHasMembership(lines: Array<Pick<CartLine, "type">>): boolean {
  return lines.some((line) => line.type === "membership");
}

function isPaypalMethod(slug: string | undefined): boolean {
  return (slug ?? "").trim().toLowerCase() === "paypal";
}

/** PayPal no cobra membresías recurrentes: se oculta si hay una en el carrito. */
export function paymentMethodsForCart<T extends { slug: string }>(
  methods: T[],
  hasMembership: boolean,
): T[] {
  if (!hasMembership) return methods;
  return methods.filter((method) => !isPaypalMethod(method.slug));
}

const SAVE_SELECTORS = '#saveCard, [name="saveCard"], [name="save_card"]';
/**
 * Frontpay usa #recurringPayment. El IIFE de Stripe pinta un checkbox sin
 * name/id ("Pago Recurrente"). Hace falta al confirmar membresía; NO en el
 * mount (un click cambia `recurringPayment` y el IIFE re-dispara
 * updateinitialpayment en bucle).
 */
const RENEW_SELECTORS =
  '#recurringPayment, [name="recurringPayment"], [name="subscribe"]';

export function findStripeRecurringCheckbox(root: ParentNode): HTMLInputElement | null {
  for (const input of root.querySelectorAll<HTMLInputElement>('stripe-payment-element input[type="checkbox"]')) {
    const labels = [...(input.labels ?? [])];
    const ancestor = input.closest("label");
    if (ancestor) labels.push(ancestor);
    if (labels.some((label) => /pago\s+recurrente/i.test(label.textContent ?? ""))) return input;
  }
  return null;
}

/** Subscribe before clicking: the IIFE can emit its result synchronously. */
function updateStripeRecurrence(input: HTMLInputElement, element: Element): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (success: boolean) => {
      clearTimeout(timer);
      element.removeEventListener("initial-payment-updated", onUpdated);
      element.removeEventListener("initial-payment-update-error", onError);
      resolve(success);
    };
    const onUpdated = () => finish(true);
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(false), 15_000);
    element.addEventListener("initial-payment-updated", onUpdated);
    element.addEventListener("initial-payment-update-error", onError);
    try {
      input.click();
    } catch {
      finish(false);
    }
  });
}

/**
 * Clicks reach GafaPayFront's React onChange handler; assigning checked does not.
 * Stripe's new-card form has no "saveCard" checkbox (GafaPayFront saves the card
 * whenever "Pago Recurrente" is on), so a missing save input is not a failure.
 * The renew input is required only when auto-renew is wanted.
 */
export async function syncGafaPayMembershipToggles(
  root: ParentNode,
  toggles: MembershipPayToggles,
): Promise<boolean> {
  const desired = [
    [() => root.querySelector<HTMLInputElement>(SAVE_SELECTORS), toggles.saveCard, false, false],
    [() => root.querySelector<HTMLInputElement>(RENEW_SELECTORS) ?? findStripeRecurringCheckbox(root), toggles.autoRenew, toggles.autoRenew, true],
  ] as const;
  const ok = () => desired.every(([findInput, checked, required]) => {
    const input = findInput();
    return input ? input.checked === checked : !required;
  });
  if (ok()) return true;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const [findInput, checked, , recurring] of desired) {
      const input = findInput();
      if (input && input.checked !== checked) {
        const stripeElement = recurring ? input.closest("stripe-payment-element") : null;
        if (stripeElement) {
          if (!await updateStripeRecurrence(input, stripeElement)) return false;
        } else {
          input.click();
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (ok()) return true;
  }
  console.warn("[gafa-sdk] No se pudieron verificar las opciones recurrentes de GafaPay.");
  return false;
}

/**
 * GAFAPay solo crea la suscripción si recibe `paymentFrequency` (días). Igual
 * que gafa.fit v1: una sola membresía (cantidad 1) con `expiration_days` > 0 y
 * nada más con costo en el carrito; si no, null (cobro único).
 */
function isEnrollmentFeeLine(line: {
  type: string;
  role?: string;
  raw?: Record<string, unknown>;
}): boolean {
  return line.role === "enrollment" || line.raw?.enrollment_fee === true;
}

export function membershipPaymentFrequency(
  lines: Array<{ type: string; amount: number; price: number; role?: string; raw?: Record<string, unknown> }>,
): string | null {
  const billable = lines.filter((line) => !isEnrollmentFeeLine(line));
  const memberships = billable.filter((line) => line.type === "membership");
  if (memberships.length !== 1) return null;
  const [membership] = memberships;
  if (membership.amount !== 1) return null;
  if (billable.some((line) => line !== membership && line.price * line.amount > 0)) return null;
  const days = Number(membership.raw?.expiration_days);
  return Number.isFinite(days) && days > 0 ? String(Math.trunc(days)) : null;
}
