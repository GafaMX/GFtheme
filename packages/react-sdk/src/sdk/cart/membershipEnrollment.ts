import { z } from "zod";
import type { CatalogItem, GafaClient, UserMembership, UserPurchase } from "../client/types";
import { formatMoney } from "./money";
import type { CartLine } from "./cartStore";

export const ENROLLMENT_LINE_ROLE = "enrollment" as const;

export type MembershipEnrollmentMode = "first_purchase" | "every_charge";
export type MembershipEnrollmentScope = "any_membership" | "same_membership";

export type MembershipEnrollmentConfig = {
  comboId: number;
  label: string;
  membershipIds: number[];
  firstTimeScope: MembershipEnrollmentScope;
  mode: MembershipEnrollmentMode;
};

const idListSchema = z.union([
  z.array(z.union([z.number(), z.string()])).transform((values) => uniquePositiveIds(values)),
  z.string().transform((value) => uniquePositiveIds(value.split(/[,\s]+/))),
  z.number().transform((value) => uniquePositiveIds([value])),
]);

const enrollmentSchema = z
  .object({
    comboId: z.union([z.number(), z.string()]).transform(Number),
    label: z.string().optional(),
    membershipIds: idListSchema,
    firstTimeScope: z.enum(["any_membership", "same_membership"]).optional(),
    mode: z.enum(["first_purchase", "every_charge"]).optional(),
  })
  .passthrough();

function uniquePositiveIds(values: Array<string | number>): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    const n = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(n) || n <= 0) continue;
    const id = Math.trunc(n);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** Sin bloque válido el SDK no cambia nada. Un JSON a medias no activa la regla. */
export function parseMembershipEnrollment(input: unknown): MembershipEnrollmentConfig | null {
  if (input == null || input === false) return null;
  if (typeof input === "string") {
    try {
      return parseMembershipEnrollment(JSON.parse(input));
    } catch {
      return null;
    }
  }
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const parsed = enrollmentSchema.safeParse(input);
  if (!parsed.success) return null;
  const comboId = parsed.data.comboId;
  if (!Number.isFinite(comboId) || comboId <= 0) return null;
  if (!parsed.data.membershipIds.length) return null;
  const label = parsed.data.label?.trim() || "Matrícula";
  return {
    comboId: Math.trunc(comboId),
    label,
    membershipIds: parsed.data.membershipIds,
    firstTimeScope: parsed.data.firstTimeScope ?? "any_membership",
    mode: parsed.data.mode ?? "first_purchase",
  };
}

export function readMembershipEnrollmentFromOptions(input: unknown): MembershipEnrollmentConfig | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  return parseMembershipEnrollment(raw.MEMBERSHIP_ENROLLMENT ?? raw.membershipEnrollment);
}

export function isEligibleMembershipId(
  config: MembershipEnrollmentConfig | null | undefined,
  membershipId: number,
): boolean {
  if (!config) return false;
  return config.membershipIds.includes(membershipId);
}

export function isEnrollmentComboId(
  config: MembershipEnrollmentConfig | null | undefined,
  comboId: number,
): boolean {
  return Boolean(config && comboId === config.comboId);
}

export function isEnrollmentLine(
  line: Pick<CartLine, "id" | "type" | "role">,
  config: MembershipEnrollmentConfig | null | undefined,
): boolean {
  if (line.role === ENROLLMENT_LINE_ROLE) return true;
  return line.type === "combo" && isEnrollmentComboId(config, line.id);
}

export function cartHasEligibleMembership(
  lines: Array<Pick<CartLine, "id" | "type">>,
  config: MembershipEnrollmentConfig | null | undefined,
): boolean {
  if (!config) return false;
  return lines.some((line) => line.type === "membership" && isEligibleMembershipId(config, line.id));
}

export function hideEnrollmentFromCatalog<T extends { id: number; type?: string }>(
  items: T[],
  config: MembershipEnrollmentConfig | null | undefined,
): T[] {
  if (!config) return items;
  return items.filter((item) => item.id !== config.comboId);
}

export function enrollmentCaption(config: MembershipEnrollmentConfig): string {
  return config.mode === "every_charge"
    ? `${config.label} · en cada cobro`
    : `${config.label} · solo primer pago`;
}

export function catalogItemPrice(item: Pick<CatalogItem, "price" | "priceFinal"> | null | undefined): number {
  if (!item) return 0;
  const price = item.priceFinal ?? item.price ?? 0;
  return Number.isFinite(price) ? price : 0;
}

export function shouldAttachEnrollmentLine(input: {
  config: MembershipEnrollmentConfig | null | undefined;
  lines: Array<Pick<CartLine, "id" | "type" | "role">>;
  combo: Pick<CatalogItem, "id" | "price" | "priceFinal"> | null | undefined;
  needsFee: boolean;
}): boolean {
  const { config, lines, combo, needsFee } = input;
  if (!config || !needsFee) return false;
  if (!cartHasEligibleMembership(lines, config)) return false;
  return catalogItemPrice(combo) > 0;
}

export function buildEnrollmentLine(input: {
  config: MembershipEnrollmentConfig;
  combo: CatalogItem;
  brandSlug: string;
  locationSlug?: string;
  currency?: { prefix: string; suffix?: string; code?: string };
}): CartLine {
  const price = catalogItemPrice(input.combo);
  const prefix = input.currency?.prefix ?? "€";
  const code = input.currency?.code ?? "";
  return {
    key: `${input.brandSlug}:combo:${input.config.comboId}`,
    id: input.config.comboId,
    type: "combo",
    name: enrollmentCaption(input.config),
    price,
    priceLabel: formatMoney(price, prefix, "", code),
    amount: 1,
    brandSlug: input.brandSlug,
    locationSlug: input.locationSlug,
    expirationLabel: "Un solo pago",
    role: ENROLLMENT_LINE_ROLE,
    locked: true,
    raw: {
      ...(input.combo.raw ?? {}),
      reservations_max: 1,
      enrollment_fee: true,
    },
  };
}

/**
 * Una línea de matrícula atada a la membresía: cantidad 1, no se quita sola,
 * desaparece si ya no hay membresía elegible o el combo vale 0 €.
 */
export function syncEnrollmentCartLines(input: {
  config: MembershipEnrollmentConfig | null | undefined;
  lines: CartLine[];
  combo: CatalogItem | null | undefined;
  needsFee: boolean;
  brandSlug?: string;
  locationSlug?: string;
  currency?: { prefix: string; suffix?: string; code?: string };
}): CartLine[] {
  const { config, lines, combo, needsFee } = input;
  if (!config) return lines;

  const withoutEnrollment = lines.filter((line) => !isEnrollmentLine(line, config));
  const attach = shouldAttachEnrollmentLine({
    config,
    lines: withoutEnrollment,
    combo,
    needsFee,
  });
  if (!attach || !combo) return withoutEnrollment;

  const brandSlug =
    input.brandSlug ??
    withoutEnrollment.find((line) => line.type === "membership")?.brandSlug ??
    withoutEnrollment[0]?.brandSlug;
  if (!brandSlug) return withoutEnrollment;

  const next = buildEnrollmentLine({
    config,
    combo,
    brandSlug,
    locationSlug:
      input.locationSlug ??
      withoutEnrollment.find((line) => line.locationSlug)?.locationSlug,
    currency: input.currency,
  });
  const existing = lines.find((line) => isEnrollmentLine(line, config));
  if (
    existing &&
    existing.id === next.id &&
    existing.price === next.price &&
    existing.locked &&
    existing.role === ENROLLMENT_LINE_ROLE &&
    existing.amount === 1
  ) {
    return lines.some((line) => isEnrollmentLine(line, config) && line !== existing)
      ? [...withoutEnrollment, { ...existing, ...next, key: existing.key }]
      : lines.map((line) => (line === existing ? { ...existing, ...next, key: existing.key } : line));
  }
  return [...withoutEnrollment, next];
}

export function discountableLines<T extends Pick<CartLine, "id" | "type" | "role">>(
  lines: T[],
  config: MembershipEnrollmentConfig | null | undefined,
): T[] {
  return lines.filter((line) => !isEnrollmentLine(line, config));
}

export function membershipChargeLines<T extends Pick<CartLine, "id" | "type" | "role" | "price" | "amount">>(
  lines: T[],
  config: MembershipEnrollmentConfig | null | undefined,
): T[] {
  return discountableLines(lines, config);
}

export type EnrollmentHistory = {
  membershipIds: number[];
  purchaseMembershipIds: number[];
  purchaseLooksLikeMembership: boolean;
};

export function membershipIdsFromHistory(
  memberships: Array<Pick<UserMembership, "id" | "membershipId" | "name">>,
): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const item of memberships) {
    const membershipId = item.membershipId;
    if (membershipId && membershipId > 0 && !seen.has(membershipId)) {
      seen.add(membershipId);
      ids.push(membershipId);
    }
  }
  return ids;
}

function readPositiveId(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.trunc(n);
}

function looksLikeMembershipType(value: unknown): boolean {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  return text === "membership" || text === "memberships" || text.includes("membres");
}

export function purchaseMembershipIds(purchases: UserPurchase[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  const add = (value: unknown) => {
    const id = readPositiveId(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  for (const purchase of purchases) {
    add(purchase.itemId);
    const items = purchase.items ?? [];
    for (const item of items) {
      const type = item.type ?? item.productType;
      if (type && !looksLikeMembershipType(type)) continue;
      if (!type && item.id == null && item.membershipId == null) continue;
      add(item.membershipId ?? item.id);
    }
  }
  return ids;
}

export function purchasesIncludeMembership(purchases: UserPurchase[]): boolean {
  if (purchaseMembershipIds(purchases).length > 0) return true;
  return purchases.some((purchase) => {
    if (looksLikeMembershipType(purchase.itemType)) return true;
    return (purchase.items ?? []).some((item) => looksLikeMembershipType(item.type ?? item.productType));
  });
}

export function customerNeedsEnrollmentFee(input: {
  config: MembershipEnrollmentConfig;
  membershipId: number;
  memberships?: Array<Pick<UserMembership, "id" | "membershipId" | "name">> | null;
  purchases?: UserPurchase[] | null;
  membershipsFailed?: boolean;
  purchasesFailed?: boolean;
}): boolean {
  if (!isEligibleMembershipId(input.config, input.membershipId)) return false;
  if (input.config.mode === "every_charge") return true;

  const membershipsOk = !input.membershipsFailed && Array.isArray(input.memberships);
  const purchasesOk = !input.purchasesFailed && Array.isArray(input.purchases);
  if (!membershipsOk && !purchasesOk) return true;

  const ownedIds = membershipsOk ? membershipIdsFromHistory(input.memberships ?? []) : [];
  if (input.config.firstTimeScope === "same_membership") {
    if (ownedIds.includes(input.membershipId)) return false;
    if (purchasesOk && purchaseMembershipIds(input.purchases ?? []).includes(input.membershipId)) {
      return false;
    }
    return true;
  }

  if (membershipsOk && (input.memberships?.length ?? 0) > 0) return false;
  if (ownedIds.length > 0) return false;
  if (purchasesOk && purchasesIncludeMembership(input.purchases ?? [])) return false;
  return true;
}

export type EnrollmentDetectionSource =
  | "memberships"
  | "purchases"
  | "empty"
  | "fail_closed"
  | "ineligible"
  | "every_charge";

export type EnrollmentDetection = {
  needed: boolean;
  firstTime: boolean;
  source: EnrollmentDetectionSource;
  sourceLabel: string;
  membershipsCount: number;
  purchasesCount: number;
  membershipsFailed: boolean;
  purchasesFailed: boolean;
};

export async function inspectEnrollmentNeed(input: {
  config: MembershipEnrollmentConfig;
  client: Pick<GafaClient, "listUserMemberships" | "listUserPurchases">;
  brandSlug: string;
  membershipId: number;
}): Promise<EnrollmentDetection> {
  if (!isEligibleMembershipId(input.config, input.membershipId)) {
    return {
      needed: false,
      firstTime: false,
      source: "ineligible",
      sourceLabel: "esa membresía no lleva matrícula",
      membershipsCount: 0,
      purchasesCount: 0,
      membershipsFailed: false,
      purchasesFailed: false,
    };
  }
  if (input.config.mode === "every_charge") {
    return {
      needed: true,
      firstTime: false,
      source: "every_charge",
      sourceLabel: "modo every_charge (siempre)",
      membershipsCount: 0,
      purchasesCount: 0,
      membershipsFailed: false,
      purchasesFailed: false,
    };
  }

  let memberships: UserMembership[] | null = null;
  let membershipsFailed = false;
  try {
    memberships = await input.client.listUserMemberships(input.brandSlug);
  } catch {
    membershipsFailed = true;
  }

  const ownedIds = membershipsFailed ? [] : membershipIdsFromHistory(memberships ?? []);
  const alreadyExempt =
    !membershipsFailed &&
    (input.config.firstTimeScope === "any_membership"
      ? (memberships?.length ?? 0) > 0
      : ownedIds.includes(input.membershipId));

  let purchases: UserPurchase[] | null = null;
  let purchasesFailed = false;
  if (!alreadyExempt) {
    try {
      purchases = await input.client.listUserPurchases(input.brandSlug);
    } catch {
      purchasesFailed = true;
    }
  }

  const needed = customerNeedsEnrollmentFee({
    config: input.config,
    membershipId: input.membershipId,
    memberships,
    purchases,
    membershipsFailed,
    purchasesFailed,
  });

  const membershipsCount = membershipsFailed ? 0 : (memberships?.length ?? 0);
  const purchasesCount = purchasesFailed ? 0 : (purchases?.length ?? 0);
  let source: EnrollmentDetectionSource = "empty";
  let sourceLabel = "historial vacío (primera vez)";
  if (membershipsFailed && purchasesFailed) {
    source = "fail_closed";
    sourceLabel = "no se pudo leer historial (fail-closed: se cobra)";
  } else if (!needed && !membershipsFailed && membershipsCount > 0) {
    source = "memberships";
    sourceLabel = "historial de membresías";
  } else if (!needed && purchasesOkHasMembership(purchases, purchasesFailed)) {
    source = "purchases";
    sourceLabel = "fallback de compras";
  } else if (needed) {
    source = membershipsFailed && purchasesFailed ? "fail_closed" : "empty";
    sourceLabel =
      membershipsFailed && purchasesFailed
        ? "no se pudo leer historial (fail-closed: se cobra)"
        : "historial vacío (primera vez)";
  }

  return {
    needed,
    firstTime: needed,
    source,
    sourceLabel,
    membershipsCount,
    purchasesCount,
    membershipsFailed,
    purchasesFailed,
  };
}

function purchasesOkHasMembership(purchases: UserPurchase[] | null, purchasesFailed: boolean): boolean {
  if (purchasesFailed || !Array.isArray(purchases)) return false;
  return purchasesIncludeMembership(purchases);
}

export async function detectEnrollmentNeed(input: {
  config: MembershipEnrollmentConfig;
  client: Pick<GafaClient, "listUserMemberships" | "listUserPurchases">;
  brandSlug: string;
  membershipId: number;
}): Promise<boolean> {
  return (await inspectEnrollmentNeed(input)).needed;
}

export const ENROLLMENT_CHARGE_FAILED_MESSAGE =
  "Tu membresía quedó registrada, pero no pudimos cobrar la matrícula. El estudio la cargará a mano. No vuelvas a pagar la membresía.";

export function enrollmentChargeFailedLog(input: {
  companyId?: number;
  userId?: number;
  membershipId?: number;
  comboId?: number;
  error?: unknown;
}): string {
  const detail = input.error instanceof Error ? input.error.message : String(input.error ?? "error");
  return `Matrícula no cobrada (company=${input.companyId ?? "?"} user=${input.userId ?? "?"} membership=${input.membershipId ?? "?"} combo=${input.comboId ?? "?"}): ${detail}`;
}
