import type { CartLineType, CatalogItem, GafaClient } from "../client/types";
import { findPurchasableItem, matchInPools, sameCatalogId, type PreselectRef } from "./findPurchasable";

export type CrossSellItemRef = {
  type: CartLineType;
  id: number;
};

export type CrossSellConfig = {
  enabled: boolean;
  /** Título libre en el paso de pago. Vacío = sin encabezado. */
  payTitle: string;
  /** Título libre en thank you. Vacío = sin encabezado. */
  thanksTitle: string;
  items: CrossSellItemRef[];
};

const LINE_TYPES: CartLineType[] = ["combo", "membership", "product"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readLineType(value: unknown): CartLineType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return LINE_TYPES.includes(normalized as CartLineType) ? (normalized as CartLineType) : null;
}

function readPositiveId(value: unknown): number | null {
  const id = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

function readTitle(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readItemRef(value: unknown): CrossSellItemRef | null {
  if (!isPlainObject(value)) return null;
  const id = readPositiveId(value.id ?? value.itemId);
  const type = readLineType(value.type ?? value.itemType) ?? "combo";
  if (id == null) return null;
  return { type, id };
}

/**
 * Acepta el objeto del Hub (`itemType` + `itemId`) y el contrato largo
 * (`items: [{ type, id }]`). Si está apagado o no hay un ID válido, no hay oferta.
 */
export function parseCrossSell(input: unknown): CrossSellConfig | null {
  if (input == null || input === false) return null;
  if (input === true) return null;
  if (!isPlainObject(input)) return null;
  if (input.enabled === false) return null;

  const items: CrossSellItemRef[] = [];
  const seen = new Set<string>();
  const push = (item: CrossSellItemRef | null) => {
    if (!item) return;
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  if (Array.isArray(input.items)) {
    for (const raw of input.items) push(readItemRef(raw));
  }
  push(readItemRef({ type: input.itemType ?? input.type, id: input.itemId ?? input.id }));

  if (!items.length) return null;
  return {
    enabled: true,
    payTitle: readTitle(input.payTitle),
    thanksTitle: readTitle(input.thanksTitle),
    items,
  };
}

export function lineTypeOf(item: CatalogItem): CartLineType {
  if (item.type === "membership") return "membership";
  if (item.type === "product") return "product";
  return "combo";
}

export function itemAlreadyInCart(
  lines: Array<{ id: number; type: CartLineType }>,
  ref: CrossSellItemRef,
): boolean {
  return lines.some((line) => line.type === ref.type && sameCatalogId(line.id, ref.id));
}

/**
 * Resuelve las ofertas contra el catálogo ya cargado y, si falta, contra
 * gafa.fit. Los IDs que no existen se omiten: no inventamos una tarjeta vacía.
 */
export async function resolveCrossSellItems(
  client: GafaClient,
  refs: CrossSellItemRef[],
  pools: { combos: CatalogItem[]; memberships: CatalogItem[]; products?: CatalogItem[] },
  preferredBrandSlug?: string,
): Promise<Array<{ ref: CrossSellItemRef; item: CatalogItem; brandSlug?: string }>> {
  const out: Array<{ ref: CrossSellItemRef; item: CatalogItem; brandSlug?: string }> = [];
  for (const ref of refs) {
    const local = matchInPools(ref, pools);
    if (local) {
      out.push({ ref: { ...ref, type: lineTypeOf(local) }, item: local, brandSlug: preferredBrandSlug });
      continue;
    }
    const match = await findPurchasableItem(client, ref, preferredBrandSlug);
    if (!match) continue;
    out.push({
      ref: { type: match.type, id: Number(match.item.id) },
      item: match.item,
      brandSlug: match.brandSlug,
    });
  }
  return out;
}

export function toPreselectRef(item: CrossSellItemRef): PreselectRef {
  return { type: item.type, id: item.id };
}

/**
 * v1 (`getFancyForBuyProduct`) manda `reservations_id` cuando la reserva ya
 * existe. Si todavía no hay reserva, el extra viaja en el mismo `/reservate`
 * con `meetings_id` (no se manda los dos: eso re-reserva la clase).
 */
export function purchaseAssociation(input: {
  meetingId?: number | null;
  reservationId?: number | null;
}): { meetingId?: number; reservationId?: number } {
  const reservationId = Number(input.reservationId);
  if (Number.isFinite(reservationId) && reservationId > 0) {
    return { reservationId };
  }
  const meetingId = Number(input.meetingId);
  if (Number.isFinite(meetingId) && meetingId > 0) {
    return { meetingId };
  }
  return {};
}
