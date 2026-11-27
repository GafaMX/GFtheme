import type { CartLine } from "./cartStore";
import { stripeSessionStatus, STRIPE_SESSION_PROGRESS_EVENT } from "../payments/stripeSessionGuard";

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
/** Frontpay sigue autoRenew; Stripe conserva su casilla al confirmar. */
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

type StripeRecurrenceState = {
  pending?: Promise<boolean>;
  cancel?: () => void;
  failed: boolean;
  failedRevision?: number;
  driving: boolean;
  queue: Promise<boolean>;
};
const stripeRecurrence = new WeakMap<Element, StripeRecurrenceState>();
function recurrenceState(element: Element): StripeRecurrenceState {
  let state = stripeRecurrence.get(element);
  if (!state) {
    state = { failed: false, driving: false, queue: Promise.resolve(true) };
    stripeRecurrence.set(element, state);
  }
  return state;
}

/** Subscribe before clicking; wait for the complete current session, including initial-purchase. */
function waitForStripeRecurrence(element: Element): Promise<boolean> {
  const state = recurrenceState(element);
  if (state.pending) return state.pending;
  const startingSession = stripeSessionStatus(element);
  const startingRevision = startingSession?.ready ? startingSession.revision : undefined;
  state.pending = new Promise((resolve) => {
    const ready = () => {
      const session = stripeSessionStatus(element);
      return session ? session.ready && session.revision !== startingRevision : undefined;
    };
    let lastProgress = Date.now();
    const finish = (success: boolean) => {
      clearTimeout(timer);
      element.removeEventListener("initial-payment-updated", onUpdated);
      element.removeEventListener("initial-payment-update-error", onError);
      element.removeEventListener(STRIPE_SESSION_PROGRESS_EVENT, onProgress);
      state.pending = undefined;
      state.cancel = undefined;
      state.failed = !success;
      const session = stripeSessionStatus(element);
      state.failedRevision = !success && session ? session.revision + (session.ready ? 1 : 0) : undefined;
      resolve(success);
    };
    const onUpdated = () => {
      // El IIFE puede emitir antes de terminar la cola o desde una revisión superada.
      if (ready() !== false) finish(true);
    };
    const onError = () => finish(false);
    const onProgress = () => {
      if (ready()) finish(true);
    };
    const check = () => {
      const session = stripeSessionStatus(element);
      if (ready()) { finish(true); return; }
      lastProgress = Math.max(lastProgress, session?.progressAt ?? 0);
      // Mismo presupuesto renovable que waitForWidgetContent: 30 s sin progreso.
      if (Date.now() - lastProgress >= 30_000) { finish(false); return; }
      timer = setTimeout(check, 50);
    };
    let timer = setTimeout(check, 50);
    state.cancel = onError;
    element.addEventListener("initial-payment-updated", onUpdated);
    element.addEventListener("initial-payment-update-error", onError);
    element.addEventListener(STRIPE_SESSION_PROGRESS_EVENT, onProgress);
  });
  return state.pending;
}

/** Delegation survives the IIFE replacing its inputs. Never clicks on mount. */
export function bindStripeMembershipRecurrence(
  root: HTMLElement,
  onAutoRenew: (checked: boolean) => void,
): () => void {
  const elements = new Set<Element>();
  let clicked: HTMLInputElement | null = null;
  const watch = (input: HTMLInputElement) => {
    const element = input.closest("stripe-payment-element")!;
    elements.add(element);
    void waitForStripeRecurrence(element);
  };
  const onClick = (event: Event) => {
    const input = findStripeRecurringCheckbox(root);
    if (input && event.target === input && !input.disabled) {
      clicked = input;
      watch(input);
    }
  };
  const onChange = (event: Event) => {
    const input = findStripeRecurringCheckbox(root);
    if (!input || event.target !== input) return;
    if (clicked !== input) watch(input);
    clicked = null;
    const state = recurrenceState(input.closest("stripe-payment-element")!);
    if (!state.driving) onAutoRenew(input.checked);
  };
  const onSuccess = (event: Event) => {
    const element = event.target;
    if (!(element instanceof Element) || !elements.has(element)) return;
    if (stripeSessionStatus(element)?.ready !== false) recurrenceState(element).failed = false;
  };
  root.addEventListener("initial-payment-updated", onSuccess, true);
  root.addEventListener(STRIPE_SESSION_PROGRESS_EVENT, onSuccess, true);
  root.addEventListener("click", onClick, true);
  root.addEventListener("change", onChange);
  return () => {
    root.removeEventListener("initial-payment-updated", onSuccess, true);
    root.removeEventListener(STRIPE_SESSION_PROGRESS_EVENT, onSuccess, true);
    root.removeEventListener("click", onClick, true);
    root.removeEventListener("change", onChange);
    for (const element of elements) recurrenceState(element).cancel?.();
  };
}

/** Only explicit modal edits drive Stripe. Serialize clicks and await the session. */
export function setStripeMembershipAutoRenew(root: ParentNode, checked: boolean): Promise<boolean> {
  const input = findStripeRecurringCheckbox(root);
  const element = input?.closest("stripe-payment-element");
  if (!input || !element) return Promise.resolve(false);
  const state = recurrenceState(element);
  state.queue = state.queue.then(async () => {
    if (state.pending && !await state.pending) return false;
    const current = findStripeRecurringCheckbox(root);
    if (!current || current.closest("stripe-payment-element") !== element) return false;
    const session = stripeSessionStatus(element);
    if (session?.ready && state.failedRevision !== undefined && session.revision >= state.failedRevision) state.failed = false;
    if (current.checked === checked) return !state.failed;
    const pending = waitForStripeRecurrence(element);
    state.driving = true;
    try {
      current.click();
    } catch {
      state.cancel?.();
    } finally {
      state.driving = false;
    }
    return await pending && current.checked === checked;
  });
  return state.queue;
}

/**
 * Clicks reach GafaPayFront's React onChange handler; assigning checked does not.
 * Stripe's new-card form has no "saveCard" checkbox (GafaPayFront saves the card
 * whenever "Pago Recurrente" is on), so a missing save input is not a failure.
 * Frontpay requires the renew input only when auto-renew is wanted.
 * Stripe keeps its current choice and blocks until its update is confirmed.
 */
export async function syncGafaPayMembershipToggles(
  root: ParentNode,
  toggles: MembershipPayToggles,
): Promise<boolean> {
  const stripe = findStripeRecurringCheckbox(root)?.closest("stripe-payment-element");
  if (stripe) {
    const state = recurrenceState(stripe);
    let queued: Promise<boolean>;
    do {
      queued = state.queue;
      await queued;
    } while (queued !== state.queue);
    while (state.pending) {
      if (!await state.pending) return false;
    }
    const session = stripeSessionStatus(stripe);
    if (session?.ready && state.failedRevision !== undefined && session.revision >= state.failedRevision) state.failed = false;
    if (state.failed) return false;
  }
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
    for (const [findInput, checked] of desired) {
      const input = findInput();
      if (input && input.checked !== checked) {
        input.click();
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
