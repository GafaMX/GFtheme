import { chooseStripeRecurrence, refreshStripeSession, hasStripeSession, stripeRecurrenceConfirmed, stripeSessionSequence, waitForStripeSession } from "../payments/stripeSessionGuard";
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

/** Solo una membresía expresamente suscribible ofrece renovación. */
export function cartHasSubscribableMembership(
  lines: Array<Pick<CartLine, "type" | "raw">>,
): boolean {
  return lines.some((line) => line.type === "membership" && coerceFlag(line.raw?.subscribable) === true);
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
/** Frontpay sigue autoRenew; Stripe conserva su casilla al confirmar. */
const RENEW_SELECTORS =
  '#recurringPayment, [name="recurringPayment"], [name="subscribe"]';
const legacyToggleVersions = new WeakMap<ParentNode, number>();

export function findStripeRecurringCheckbox(root: ParentNode): HTMLInputElement | null {
  for (const input of root.querySelectorAll<HTMLInputElement>('stripe-payment-element input[type="checkbox"]')) {
    const labels = [...(input.labels ?? [])];
    const ancestor = input.closest("label");
    if (ancestor) labels.push(ancestor);
    if (labels.some((label) => /pago\s+recurrente/i.test(label.textContent ?? ""))) return input;
  }
  return null;
}

type StripeRecurrenceState = {
  desired: boolean;
  running?: Promise<boolean>;
  driving: boolean;
};
const stripeRecurrence = new WeakMap<Element, StripeRecurrenceState>();

/** DOM events signal surface availability, never acknowledge a recurrence edit. */
export function bindStripeMembershipRecurrence(
  root: HTMLElement,
  onAutoRenew: (checked: boolean) => void,
  onSessionReady: () => void = () => undefined,
): () => void {
  const onSession = (event: Event) => {
    if (event.target instanceof Element && hasStripeSession(event.target)) onSessionReady();
  };
  const onChange = (event: Event) => {
    const input = findStripeRecurringCheckbox(root);
    if (!input || event.target !== input) return;
    const element = input.closest("stripe-payment-element")!;
    if (!stripeRecurrence.get(element)?.driving) onAutoRenew(input.checked);
  };
  root.addEventListener("change", onChange);
  root.addEventListener("gafa-stripe-session", onSession);
  return () => {
    root.removeEventListener("change", onChange);
    root.removeEventListener("gafa-stripe-session", onSession);
  };
}

function waitForStripeCheckbox(element: Element): Promise<HTMLInputElement | null> {
  const existing = findStripeRecurringCheckbox(element);
  if (existing || element.getAttribute("has-recurring-payment") !== "true") return Promise.resolve(existing);
  return new Promise((resolve) => {
    const finish = (input: HTMLInputElement | null) => {
      clearTimeout(timer);
      observer.disconnect();
      element.removeEventListener("gafa-stripe-session", check);
      resolve(input);
    };
    const check = () => {
      const input = findStripeRecurringCheckbox(element);
      if (!hasStripeSession(element) || input) finish(input);
    };
    const observer = new MutationObserver(check);
    const timer = setTimeout(() => finish(null), 15_000);
    observer.observe(element, { childList: true, subtree: true });
    element.addEventListener("gafa-stripe-session", check);
    check();
  });
}

/** Coalesce SDK edits, serialize provider clicks, and drain real HTTP requests. */
export function setStripeMembershipAutoRenew(root: ParentNode, checked: boolean): Promise<boolean> {
  const element = root.querySelector("stripe-payment-element");
  if (!element || !hasStripeSession(element)) return Promise.resolve(false);
  let state = stripeRecurrence.get(element);
  if (!state) {
    state = { desired: checked, driving: false };
    stripeRecurrence.set(element, state);
  }
  const currentState = state;
  currentState.desired = checked;
  chooseStripeRecurrence(element, checked);
  if (!currentState.running) {
    currentState.running = (async () => {
      await Promise.resolve();
      while (true) {
        if (!await waitForStripeSession(element)) return false;
        const desired = currentState.desired;
        const input = await waitForStripeCheckbox(element);
        if (!input && element.getAttribute("has-recurring-payment") === "true") return false;
        if (input && input.closest("stripe-payment-element") !== element) return false;
        if (input && input.checked !== desired) {
          if (input.disabled) return false;
          const sequence = stripeSessionSequence(element);
          currentState.driving = true;
          try { input.click(); } finally { currentState.driving = false; }
          // Wait for this version, including a React effect that starts later.
          if (!await waitForStripeSession(element, sequence)) return false;
          if (!stripeRecurrenceConfirmed(element, desired)) continue;
        } else if (!stripeRecurrenceConfirmed(element, desired)) {
          if (!await refreshStripeSession(element) && desired === currentState.desired) return false;
          // Session replacement can cause the IIFE to issue its mount update.
          await new Promise((resolve) => setTimeout(resolve, 0));
          continue;
        }
        if (desired !== currentState.desired) continue;
        return stripeRecurrenceConfirmed(element, desired)
          && (input ? input.checked === desired
            : !desired && coerceFlag(element.getAttribute("has-recurring-payment")) === false);
      }
    })().catch(() => false).finally(() => { currentState.running = undefined; });
  }
  return currentState.running.then((ok) => ok && currentState.desired === checked);
}

/**
 * Clicks reach GafaPayFront's React onChange handler; assigning checked does not.
 * Stripe's new-card form has no "saveCard" checkbox (GafaPayFront saves the card
 * whenever "Pago Recurrente" is on), so a missing save input is not a failure.
 * Frontpay requires the renew input only when auto-renew is wanted.
 * Stripe blocks until its queue finishes and the session matches the SDK choice.
 */
export async function syncGafaPayMembershipToggles(
  root: ParentNode,
  toggles: MembershipPayToggles,
): Promise<boolean> {
  const stripe = root.querySelector("stripe-payment-element");
  if (stripe) {
    let pending: Promise<boolean> | undefined;
    do {
      pending = stripeRecurrence.get(stripe)?.running;
      if (pending) await pending;
    } while (pending !== stripeRecurrence.get(stripe)?.running && stripeRecurrence.get(stripe)?.running);
    if (!await waitForStripeSession(stripe) || !stripeRecurrenceConfirmed(stripe, toggles.autoRenew)) return false;
    const input = findStripeRecurringCheckbox(root);
    if (input ? input.checked !== toggles.autoRenew
      : toggles.autoRenew || coerceFlag(stripe.getAttribute("has-recurring-payment")) !== false) return false;
  }
  // Un clic posterior o el preflight de pago invalida reintentos anteriores.
  // Así una sincronización pendiente no revierte la última elección del SDK.
  const version = (legacyToggleVersions.get(root) ?? 0) + 1;
  if (!stripe) legacyToggleVersions.set(root, version);
  const superseded = () => !stripe && legacyToggleVersions.get(root) !== version;
  const desired = [
    [() => root.querySelector<HTMLInputElement>(SAVE_SELECTORS), toggles.saveCard, false],
    [() => stripe ? null : root.querySelector<HTMLInputElement>(RENEW_SELECTORS), toggles.autoRenew, !stripe && toggles.autoRenew],
  ] as const;
  const ok = () => desired.every(([findInput, checked, required]) => {
    const input = findInput();
    return input ? input.checked === checked : !required;
  });
  if (ok()) return true;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (superseded()) return false;
    for (const [findInput, checked] of desired) {
      const input = findInput();
      if (input && input.checked !== checked) {
        input.click();
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (superseded()) return false;
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
