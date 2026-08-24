import type { CartLine } from "./cartStore";

export type MembershipPayToggles = {
  saveCard: boolean;
  autoRenew: boolean;
};

export function cartHasMembership(lines: Array<Pick<CartLine, "type">>): boolean {
  return lines.some((line) => line.type === "membership");
}

const SAVE_SELECTORS = '#saveCard, [name="saveCard"], [name="save_card"]';
const RENEW_SELECTORS = '#recurringPayment, [name="recurringPayment"], [name="subscribe"]';

function setChecked(input: HTMLInputElement | null, next: boolean) {
  if (!input || input.checked === next) return;
  input.checked = next;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Alinea los checkboxes de GafaPayFront (v1: #saveCard / #recurringPayment). */
export function syncGafaPayMembershipToggles(root: ParentNode, toggles: MembershipPayToggles): void {
  setChecked(root.querySelector<HTMLInputElement>(SAVE_SELECTORS), toggles.saveCard);
  setChecked(root.querySelector<HTMLInputElement>(RENEW_SELECTORS), toggles.autoRenew);
}
