import type { CartLineType, CatalogItem, GafaClient } from "../client/types";

export type PreselectRef = {
  type: CartLineType;
  id: number;
};

export type PurchasableMatch = {
  item: CatalogItem;
  type: CartLineType;
  brandSlug: string;
};

export function sameCatalogId(a: number | string | undefined | null, b: number | string | undefined | null): boolean {
  if (a == null || b == null) return false;
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && left === right;
}

function lineTypeOf(item: CatalogItem): CartLineType {
  if (item.type === "membership") return "membership";
  if (item.type === "product") return "product";
  return "combo";
}

/**
 * Busca el ID primero en el tipo que declaró el botón y, si no está, en todo
 * el catálogo. En sitios multi-sede el HTML a veces marca membresía como
 * paquete (o al revés) y el fancy se abría vacío.
 */
export function matchInPools(
  preselect: PreselectRef,
  pools: { combos: CatalogItem[]; memberships: CatalogItem[]; products?: CatalogItem[] },
): CatalogItem | undefined {
  const preferred =
    preselect.type === "membership"
      ? pools.memberships
      : preselect.type === "product"
        ? (pools.products ?? [])
        : pools.combos;
  const hit = preferred.find((item) => sameCatalogId(item.id, preselect.id));
  if (hit) return hit;
  return [...pools.combos, ...pools.memberships, ...(pools.products ?? [])].find((item) =>
    sameCatalogId(item.id, preselect.id),
  );
}

/**
 * Resuelve un botón COMPRAR contra el catálogo real de gafa.fit.
 *
 * Fitspin (y socios parecidos) tienen más de una marca: el paquete de Lomas
 * no vive en `fitspin-cancun`. Si solo se mira la primera marca/sede, el
 * fancy abre sin producto.
 */
export async function findPurchasableItem(
  client: GafaClient,
  preselect: PreselectRef,
  preferredBrandSlug?: string,
): Promise<PurchasableMatch | null> {
  const brands = await client.listBrands();
  const ordered = preferredBrandSlug
    ? [
        ...brands.filter((brand) => brand.slug === preferredBrandSlug),
        ...brands.filter((brand) => brand.slug !== preferredBrandSlug),
      ]
    : brands;

  for (const brand of ordered) {
    const [combos, memberships] = await Promise.all([
      client.listCombos(brand.slug),
      client.listMemberships(brand.slug),
    ]);
    const item = matchInPools(preselect, { combos, memberships });
    if (!item) continue;
    return { item, type: lineTypeOf(item), brandSlug: brand.slug };
  }

  return null;
}
