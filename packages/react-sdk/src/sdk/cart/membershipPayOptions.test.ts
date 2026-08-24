import { describe, expect, it } from "vitest";
import { cartHasMembership, syncGafaPayMembershipToggles } from "./membershipPayOptions";

describe("cartHasMembership", () => {
  it("solo las membresías activan renovación / guardar tarjeta", () => {
    expect(cartHasMembership([{ type: "combo" }])).toBe(false);
    expect(cartHasMembership([{ type: "membership" }])).toBe(true);
    expect(cartHasMembership([{ type: "combo" }, { type: "membership" }])).toBe(true);
  });
});

describe("syncGafaPayMembershipToggles", () => {
  it("marca saveCard y recurringPayment como en el fancy v1", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <input id="saveCard" type="checkbox" />
      <input id="recurringPayment" type="checkbox" />
    `;
    syncGafaPayMembershipToggles(root, { saveCard: true, autoRenew: true });
    expect(root.querySelector<HTMLInputElement>("#saveCard")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("#recurringPayment")?.checked).toBe(true);

    syncGafaPayMembershipToggles(root, { saveCard: false, autoRenew: true });
    expect(root.querySelector<HTMLInputElement>("#saveCard")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("#recurringPayment")?.checked).toBe(true);
  });
});
