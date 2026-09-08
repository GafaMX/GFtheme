import type { QueryClient } from "@tanstack/react-query";
import type { CatalogItem, GafaClient } from "../client/types";
import { useCartStore } from "./cartStore";

export const CHECKOUT_CATALOG_STALE_MS = 60_000;

export function checkoutCatalogQueryKey(brandSlug: string | undefined) {
  return ["checkout", "catalog", brandSlug] as const;
}

export async function fetchCheckoutCatalog(client: GafaClient, brandSlug: string) {
  const [combos, memberships] = await Promise.all([
    client.listCombos(brandSlug),
    client.listMemberships(brandSlug),
  ]);
  return { combos, memberships } as { combos: CatalogItem[]; memberships: CatalogItem[] };
}

/** Empieza a bajar el catalogo antes de abrir el fancy, para no pintar vacio. */
export function prefetchCheckoutCatalog(
  queryClient: QueryClient,
  client: GafaClient,
  brandSlug?: string,
) {
  const slug = brandSlug ?? useCartStore.getState().lines[0]?.brandSlug;
  if (!slug) return;
  void queryClient.prefetchQuery({
    queryKey: checkoutCatalogQueryKey(slug),
    queryFn: () => fetchCheckoutCatalog(client, slug),
    staleTime: CHECKOUT_CATALOG_STALE_MS,
  });
}
