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
const RENEW_SELECTORS = '#recurringPayment, [name="recurringPayment"], [name="subscribe"]';

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
    [SAVE_SELECTORS, toggles.saveCard, false],
    [RENEW_SELECTORS, toggles.autoRenew, toggles.autoRenew],
  ] as const;
  const ok = () => desired.every(([selector, checked, required]) => {
    const input = root.querySelector<HTMLInputElement>(selector);
    return input ? input.checked === checked : !required;
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const [selector, checked] of desired) {
      const input = root.querySelector<HTMLInputElement>(selector);
      if (input && input.checked !== checked) input.click();
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (ok()) return true;
  }
  console.warn("[gafa-sdk] No se pudieron verificar las opciones recurrentes de GafaPay.");
  return false;
}
