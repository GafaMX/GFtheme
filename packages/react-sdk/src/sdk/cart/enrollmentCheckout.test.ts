import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartLine } from "./cartStore";
import { ENROLLMENT_CHARGE_FAILED_MESSAGE, parseMembershipEnrollment } from "./membershipEnrollment";
import { ENROLLMENT_CHARGE_ATTEMPTS, runSplitEnrollmentCheckout } from "./enrollmentCheckout";
import { reservateRetryWait } from "./reservateRetry";

const config = parseMembershipEnrollment({
  comboId: 3491,
  membershipIds: [1271],
})!;

const silver: CartLine = {
  key: "the-base:membership:1271",
  id: 1271,
  type: "membership",
  name: "Silver",
  price: 85,
  priceLabel: "85€",
  amount: 1,
  brandSlug: "the-base",
};

const fee: CartLine = {
  key: "the-base:combo:3491",
  id: 3491,
  type: "combo",
  name: "Matrícula · solo primer pago",
  price: 30,
  priceLabel: "30€",
  amount: 1,
  brandSlug: "the-base",
  role: "enrollment",
  locked: true,
};

describe("runSplitEnrollmentCheckout", () => {
  beforeEach(() => {
    reservateRetryWait.wait = async () => undefined;
  });

  it("registra la membresía con suscripción y la matrícula como cobro único", async () => {
    const reservate = vi.fn(async () => ({ purchaseId: 1 }));
    const chargeEnrollment = vi.fn(async () => ({ message: { token: "enroll" } }));
    const result = await runSplitEnrollmentCheckout({
      config,
      lines: [silver, fee],
      membershipPayment: { message: { token: "mem" }, subscriptionId: "sub_1", recurringPayment: true },
      reservate,
      chargeEnrollment,
      discountCode: "Familia10",
      wait: async () => undefined,
    });
    expect(result.enrollmentOk).toBe(true);
    expect(reservate).toHaveBeenCalledTimes(2);
    expect(reservate.mock.calls[0][0].lines).toEqual([silver]);
    expect(reservate.mock.calls[0][0].subscribe).toBe(true);
    expect(reservate.mock.calls[0][0].discountCode).toBe("Familia10");
    expect(reservate.mock.calls[1][0].lines).toEqual([fee]);
    expect(reservate.mock.calls[1][0].subscribe).toBe(false);
    expect(reservate.mock.calls[1][0].discountCode).toBeNull();
    expect(chargeEnrollment).toHaveBeenCalledTimes(1);
  });

  it("si el segundo cobro falla, reintenta y avisa en español", async () => {
    const reservate = vi.fn(async (payload: { lines: CartLine[] }) => {
      if (payload.lines[0]?.role === "enrollment") throw new Error("card declined");
      return { purchaseId: 1 };
    });
    const chargeEnrollment = vi.fn(async () => ({ message: { token: "enroll" } }));
    const result = await runSplitEnrollmentCheckout({
      config,
      lines: [silver, fee],
      membershipPayment: { message: { token: "mem" }, subscriptionId: "sub_1", recurringPayment: true },
      reservate,
      chargeEnrollment,
      wait: async () => undefined,
    });
    expect(result.membershipOk).toBe(true);
    expect(result.enrollmentOk).toBe(false);
    expect(chargeEnrollment).toHaveBeenCalledTimes(ENROLLMENT_CHARGE_ATTEMPTS);
    expect(result.warning).toBe(ENROLLMENT_CHARGE_FAILED_MESSAGE);
    expect(result.log).toMatch(/Matrícula no cobrada/);
  });

  it("si falla el cargo de matrícula, reintenta el cobro", async () => {
    const reservate = vi.fn(async () => ({ purchaseId: 1 }));
    const chargeEnrollment = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ message: { token: "enroll" } });
    const result = await runSplitEnrollmentCheckout({
      config,
      lines: [silver, fee],
      membershipPayment: { message: { token: "mem" }, recurringPayment: true },
      reservate,
      chargeEnrollment,
      wait: async () => undefined,
    });
    expect(result.enrollmentOk).toBe(true);
    expect(chargeEnrollment).toHaveBeenCalledTimes(2);
  });
});
