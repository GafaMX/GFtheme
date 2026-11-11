import type { GafaPaySuccess } from "../payments/gafaPay";
import type { CartLine } from "./cartStore";
import {
  ENROLLMENT_CHARGE_FAILED_MESSAGE,
  buildEnrollmentChargeFailedNotice,
  isEnrollmentLine,
  membershipChargeLines,
  type EnrollmentChargeFailedNotice,
  type MembershipEnrollmentConfig,
} from "./membershipEnrollment";
import { retryReservate } from "./reservateRetry";

export const ENROLLMENT_CHARGE_ATTEMPTS = 2;

export type EnrollmentReservatePayload = {
  lines: CartLine[];
  paymentData: unknown;
  recurring: boolean;
  subscriptionId: string | number | null;
  discountCode: string | null;
  subscribe: boolean;
  setPayment: boolean;
};

export type SplitEnrollmentResult = {
  membershipOk: boolean;
  enrollmentOk: boolean;
  enrollmentAttempted: boolean;
  membershipPayment: GafaPaySuccess;
  enrollmentPayment?: GafaPaySuccess;
  warning?: string;
  log?: string;
  notice?: EnrollmentChargeFailedNotice;
};

export async function runSplitEnrollmentCheckout(input: {
  config: MembershipEnrollmentConfig;
  lines: CartLine[];
  membershipPayment: GafaPaySuccess;
  reservate: (payload: EnrollmentReservatePayload) => Promise<unknown>;
  chargeEnrollment: () => Promise<GafaPaySuccess>;
  discountCode?: string | null;
  saveCard?: boolean;
  autoRenew?: boolean;
  wait?: (ms: number) => Promise<void>;
  logContext?: {
    companyId?: number;
    userId?: number;
    customerName?: string;
    customerEmail?: string;
    membershipId?: number;
    membershipName?: string;
  };
}): Promise<SplitEnrollmentResult> {
  const membershipLines = membershipChargeLines(input.lines, input.config);
  const enrollmentLines = input.lines.filter((line) => isEnrollmentLine(line, input.config));
  const enrollmentLine = enrollmentLines[0];

  await retryReservate((attempt) =>
    input.reservate({
      lines: membershipLines,
      paymentData: input.membershipPayment.message,
      recurring: Boolean(input.membershipPayment.recurringPayment),
      subscriptionId: input.membershipPayment.subscriptionId ?? null,
      discountCode: attempt === 0 ? input.discountCode ?? null : null,
      subscribe: input.autoRenew ?? true,
      setPayment: input.saveCard ?? true,
    }),
  );

  if (!enrollmentLine || enrollmentLine.price * enrollmentLine.amount <= 0) {
    return {
      membershipOk: true,
      enrollmentOk: true,
      enrollmentAttempted: false,
      membershipPayment: input.membershipPayment,
    };
  }

  const wait = input.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastError: unknown;
  for (let attempt = 0; attempt < ENROLLMENT_CHARGE_ATTEMPTS; attempt += 1) {
    try {
      const enrollmentPayment = await input.chargeEnrollment();
      await retryReservate(() =>
        input.reservate({
          lines: [enrollmentLine],
          paymentData: enrollmentPayment.message,
          recurring: false,
          subscriptionId: null,
          discountCode: null,
          subscribe: false,
          setPayment: false,
        }),
      );
      return {
        membershipOk: true,
        enrollmentOk: true,
        enrollmentAttempted: true,
        membershipPayment: input.membershipPayment,
        enrollmentPayment,
      };
    } catch (error) {
      lastError = error;
      if (attempt + 1 < ENROLLMENT_CHARGE_ATTEMPTS) await wait(400);
    }
  }

  const notice = buildEnrollmentChargeFailedNotice({
    ...input.logContext,
    membershipName: input.logContext?.membershipName ?? membershipLines[0]?.name,
    membershipId: input.logContext?.membershipId ?? membershipLines[0]?.id,
    comboId: input.config.comboId,
    enrollmentAmount: enrollmentLine.price * enrollmentLine.amount,
    enrollmentAmountLabel: enrollmentLine.priceLabel,
    error: lastError,
  });
  return {
    membershipOk: true,
    enrollmentOk: false,
    enrollmentAttempted: true,
    membershipPayment: input.membershipPayment,
    warning: ENROLLMENT_CHARGE_FAILED_MESSAGE,
    log: notice.log,
    notice,
  };
}
