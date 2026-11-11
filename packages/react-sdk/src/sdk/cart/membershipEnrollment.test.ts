import { describe, expect, it } from "vitest";
import type { CartLine } from "./cartStore";
import type { CatalogItem } from "../client/types";
import {
  buildEnrollmentChargeFailedNotice,
  buildEnrollmentLine,
  customerNeedsEnrollmentFee,
  discountableLines,
  hideEnrollmentFromCatalog,
  inspectEnrollmentNeed,
  isEnrollmentLine,
  parseMembershipEnrollment,
  readEnrollmentFailureNotifyUrl,
  shouldAttachEnrollmentLine,
  syncEnrollmentCartLines,
} from "./membershipEnrollment";
import { resolveDiscountAmount } from "./discountCode";
import { cartSubtotal } from "./cartStore";

const config = parseMembershipEnrollment({
  comboId: 3491,
  label: "Matrícula",
  membershipIds: [1272, 1271, 1204],
  firstTimeScope: "any_membership",
  mode: "first_purchase",
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

const founder: CartLine = {
  key: "the-base:membership:1203",
  id: 1203,
  type: "membership",
  name: "Socio Fundador",
  price: 85,
  priceLabel: "85€",
  amount: 1,
  brandSlug: "the-base",
};

const bono: CartLine = {
  key: "the-base:combo:10",
  id: 10,
  type: "combo",
  name: "Bono 10",
  price: 65,
  priceLabel: "65€",
  amount: 1,
  brandSlug: "the-base",
};

const combo: CatalogItem = {
  id: 3491,
  name: "Matrícula",
  type: "combo",
  price: 30,
  priceFinal: 30,
  raw: { id: 3491, credits: 0 },
};

describe("parseMembershipEnrollment", () => {
  it("sin bloque no activa nada", () => {
    expect(parseMembershipEnrollment(undefined)).toBeNull();
    expect(parseMembershipEnrollment({})).toBeNull();
    expect(parseMembershipEnrollment({ comboId: 3491 })).toBeNull();
  });

  it("acepta membershipIds como texto (Hub)", () => {
    const parsed = parseMembershipEnrollment({
      comboId: "3491",
      membershipIds: "1272, 1271, 1204",
    });
    expect(parsed?.comboId).toBe(3491);
    expect(parsed?.membershipIds).toEqual([1272, 1271, 1204]);
    expect(parsed?.firstTimeScope).toBe("any_membership");
    expect(parsed?.mode).toBe("first_purchase");
  });

  it("guarda failureNotifyUrl solo si es https (o http local)", () => {
    expect(
      parseMembershipEnrollment({
        comboId: 3491,
        membershipIds: [1271],
        failureNotifyUrl: "https://fn.buq.partners/enrollment-failed",
      })?.failureNotifyUrl,
    ).toBe("https://fn.buq.partners/enrollment-failed");
    expect(
      parseMembershipEnrollment({
        comboId: 3491,
        membershipIds: [1271],
        failureNotifyUrl: "javascript:alert(1)",
      })?.failureNotifyUrl,
    ).toBeUndefined();
    expect(readEnrollmentFailureNotifyUrl("http://hooks.slack.com/x")).toBeUndefined();
    expect(readEnrollmentFailureNotifyUrl("http://127.0.0.1:8787/notice")).toBe(
      "http://127.0.0.1:8787/notice",
    );
  });
});

describe("buildEnrollmentChargeFailedNotice", () => {
  it("incluye cliente, membresía, monto, motivo, fecha y company", () => {
    const notice = buildEnrollmentChargeFailedNotice({
      companyId: 204,
      userId: 4412,
      customerName: "Gabriel Test",
      customerEmail: "gabriel@buq.mx",
      membershipId: 1271,
      membershipName: "Silver",
      comboId: 3491,
      enrollmentAmount: 30,
      enrollmentAmountLabel: "30€",
      error: new Error("card declined"),
      occurredAt: "2026-11-11T04:38:00.000Z",
    });
    expect(notice.kind).toBe("enrollment_charge_failed");
    expect(notice.customerName).toBe("Gabriel Test");
    expect(notice.customerEmail).toBe("gabriel@buq.mx");
    expect(notice.membershipName).toBe("Silver");
    expect(notice.enrollmentAmountLabel).toBe("30€");
    expect(notice.error).toBe("card declined");
    expect(notice.companyId).toBe(204);
    expect(notice.occurredAt).toBe("2026-11-11T04:38:00.000Z");
    expect(notice.log).toMatch(/gabriel@buq.mx/);
  });
});

describe("customerNeedsEnrollmentFee", () => {
  it("Socio Fundador nunca lleva matrícula", () => {
    expect(
      customerNeedsEnrollmentFee({
        config,
        membershipId: 1203,
        memberships: [],
        purchases: [],
      }),
    ).toBe(false);
  });

  it("fail-closed si fallan membresías y compras", () => {
    expect(
      customerNeedsEnrollmentFee({
        config,
        membershipId: 1271,
        membershipsFailed: true,
        purchasesFailed: true,
      }),
    ).toBe(true);
  });

  it("any_membership: si ya tuvo alguna membresía (vencida incluida) no cobra", () => {
    expect(
      customerNeedsEnrollmentFee({
        config,
        membershipId: 1271,
        memberships: [{ id: 9, membershipId: 1203, name: "Socio Fundador" }],
      }),
    ).toBe(false);
  });

  it("same_membership: cobra si tuvo otra membresía distinta", () => {
    expect(
      customerNeedsEnrollmentFee({
        config: { ...config, firstTimeScope: "same_membership" },
        membershipId: 1271,
        memberships: [{ id: 9, membershipId: 1272, name: "Bronze" }],
      }),
    ).toBe(true);
  });

  it("every_charge siempre cobra en membresías elegibles", () => {
    expect(
      customerNeedsEnrollmentFee({
        config: { ...config, mode: "every_charge" },
        membershipId: 1271,
        memberships: [{ id: 9, membershipId: 1271, name: "Silver" }],
      }),
    ).toBe(true);
  });

  it("fallback a purchases si /memberships viene vacío", () => {
    const purchases: UserPurchase[] = [
      {
        id: 1,
        name: "Silver",
        total: 85,
        items: [{ id: 1271, type: "membership", membershipId: 1271 }],
      },
    ];
    expect(
      customerNeedsEnrollmentFee({
        config,
        membershipId: 1272,
        memberships: [],
        purchases,
      }),
    ).toBe(false);
  });
});

describe("locked cart line / hidden combo", () => {
  it("agrega la línea atada a Silver la primera vez", () => {
    expect(shouldAttachEnrollmentLine({ config, lines: [silver], combo, needsFee: true })).toBe(true);
    const next = syncEnrollmentCartLines({
      config,
      lines: [silver],
      combo,
      needsFee: true,
      brandSlug: "the-base",
      currency: { prefix: "€", code: "EUR" },
    });
    expect(next).toHaveLength(2);
    const fee = next.find((line) => isEnrollmentLine(line, config))!;
    expect(fee.locked).toBe(true);
    expect(fee.amount).toBe(1);
    expect(fee.price).toBe(30);
    expect(fee.name).toMatch(/solo primer pago/i);
  });

  it("si el combo vale 0 € no agrega la línea", () => {
    const free = { ...combo, price: 0, priceFinal: 0 };
    expect(shouldAttachEnrollmentLine({ config, lines: [silver], combo: free, needsFee: true })).toBe(false);
    expect(
      syncEnrollmentCartLines({ config, lines: [silver], combo: free, needsFee: true, brandSlug: "the-base" }),
    ).toEqual([silver]);
  });

  it("Socio Fundador, bonos y combo suelto no llevan matrícula", () => {
    expect(shouldAttachEnrollmentLine({ config, lines: [founder], combo, needsFee: true })).toBe(false);
    expect(shouldAttachEnrollmentLine({ config, lines: [bono], combo, needsFee: true })).toBe(false);
    const stray: CartLine = {
      key: "the-base:combo:3491",
      id: 3491,
      type: "combo",
      name: "Matrícula",
      price: 30,
      priceLabel: "30€",
      amount: 1,
      brandSlug: "the-base",
    };
    expect(syncEnrollmentCartLines({ config, lines: [stray, bono], combo, needsFee: true })).toEqual([bono]);
  });

  it("quita la matrícula si se quita la membresía", () => {
    const withFee = syncEnrollmentCartLines({
      config,
      lines: [silver],
      combo,
      needsFee: true,
      brandSlug: "the-base",
    });
    expect(
      syncEnrollmentCartLines({ config, lines: withFee.filter((line) => line.type !== "membership"), combo, needsFee: true }),
    ).toEqual([]);
  });

  it("oculta el combo del catálogo", () => {
    expect(hideEnrollmentFromCatalog([combo, { id: 10, name: "Bono", type: "combo" as const }], config)).toEqual([
      { id: 10, name: "Bono", type: "combo" },
    ]);
  });
});

describe("inspectEnrollmentNeed", () => {
  it("marca primera vez cuando el historial de membresías está vacío", async () => {
    const result = await inspectEnrollmentNeed({
      config,
      brandSlug: "the-base",
      membershipId: 1271,
      client: {
        listUserMemberships: async () => [],
        listUserPurchases: async () => [],
      },
    });
    expect(result.needed).toBe(true);
    expect(result.firstTime).toBe(true);
    expect(result.source).toBe("empty");
    expect(result.sourceLabel).toMatch(/historial vacío/);
  });

  it("usa el historial de membresías para un recurrente", async () => {
    const result = await inspectEnrollmentNeed({
      config,
      brandSlug: "the-base",
      membershipId: 1271,
      client: {
        listUserMemberships: async () => [{ id: 9, membershipId: 1272, name: "Bronze" }],
        listUserPurchases: async () => {
          throw new Error("no debería caer al fallback");
        },
      },
    });
    expect(result.needed).toBe(false);
    expect(result.source).toBe("memberships");
    expect(result.sourceLabel).toBe("historial de membresías");
  });

  it("cae al fallback de compras si no hay membresías", async () => {
    const result = await inspectEnrollmentNeed({
      config,
      brandSlug: "the-base",
      membershipId: 1271,
      client: {
        listUserMemberships: async () => [],
        listUserPurchases: async () => [
          {
            id: 1,
            name: "Silver",
            total: 85,
            items: [{ membershipId: 1271, type: "membership" }],
          },
        ],
      },
    });
    expect(result.needed).toBe(false);
    expect(result.source).toBe("purchases");
    expect(result.sourceLabel).toBe("fallback de compras");
  });
});

describe("descuentos no aplican a la matrícula", () => {
  it("el % cae solo sobre la membresía", () => {
    const lines = syncEnrollmentCartLines({
      config,
      lines: [silver],
      combo,
      needsFee: true,
      brandSlug: "the-base",
    });
    const discountable = cartSubtotal(discountableLines(lines, config));
    expect(discountable).toBe(85);
    expect(resolveDiscountAmount({ valid: true, code: "Familia10", discountType: "percent", discountNumber: 10 }, discountable)).toBe(
      8.5,
    );
    expect(cartSubtotal(lines) - 8.5).toBe(106.5);
  });
});
