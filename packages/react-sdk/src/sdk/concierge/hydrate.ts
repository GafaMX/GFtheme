import type { CatalogItem, Location } from "../client/types";
import type { ConciergePartnerConfig, ConciergeProduct, ConciergeStudio } from "./contracts";

export type ConciergeHydrateClient = {
  listLocations(brand?: string): Promise<unknown[]>;
  listCombos(brand: string): Promise<CatalogItem[]>;
  listMemberships(brand: string): Promise<CatalogItem[]>;
};

function asLocation(value: unknown): (Partial<Location> & { id: number | string }) | null {
  if (!value || typeof value !== "object") return null;
  const location = value as Record<string, unknown>;
  if (location.id == null) return null;
  return location as Partial<Location> & { id: number | string };
}

function productKey(product: ConciergeProduct): string {
  return `${product.type}:${product.id}:${product.brandSlug}`;
}

function dedupeByTypeId(products: ConciergeProduct[]): ConciergeProduct[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    const key = `${product.type}:${product.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function locationAllowed(
  brandLocationIds: string[],
  location: { id: number | string },
): boolean {
  if (!brandLocationIds.length) return true;
  return brandLocationIds.includes(String(location.id));
}

function studioFromLocation(
  location: Partial<Location> & { id: number | string; name?: string; slug?: string; brandSlug?: string },
  brandSlug: string,
): ConciergeStudio {
  const name = location.name || location.slug || String(location.id);
  return {
    id: location.slug || String(location.id),
    name,
    city: name,
    address: name,
    mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(name)}`,
    locationId: String(location.id),
    brandSlug: location.brandSlug || brandSlug,
    slug: location.slug || String(location.id),
  };
}

function productFromItem(
  item: CatalogItem,
  type: ConciergeProduct["type"],
  brandSlug: string,
  locationId: string,
): ConciergeProduct {
  return {
    type,
    id: String(item.id),
    brandSlug,
    locationId,
    name: item.name,
    price: item.priceLabel || (item.price != null ? `$${item.price}` : "$0"),
    note: item.description || "",
  };
}

export function shouldHydrateConcierge(config: ConciergePartnerConfig, hydrateFromClient?: boolean): boolean {
  if (hydrateFromClient === false) return false;
  if (hydrateFromClient === true) return true;
  return config.catalog.live === true;
}

export async function hydrateConciergeCatalog(
  config: ConciergePartnerConfig,
  client: ConciergeHydrateClient,
): Promise<ConciergePartnerConfig> {
  const liveProducts: ConciergeProduct[] = [];
  const liveStudios: ConciergeStudio[] = [];
  const seenStudios = new Set(config.studios.map((studio) => `${studio.brandSlug}:${studio.locationId}`));
  const seenProducts = new Set<string>();

  for (const brand of config.buq.brands) {
    let locations: Array<Partial<Location> & { id: number | string }> = [];
    try {
      locations = (await client.listLocations(brand.slug)).flatMap((value) => {
        const location = asLocation(value);
        return location ? [location] : [];
      });
    } catch {
      locations = [];
    }

    const allowed = locations.filter((location) => locationAllowed(brand.locationIds, location));
    const usable = allowed.length ? allowed : locations;
    for (const location of usable) {
      const key = `${location.brandSlug || brand.slug}:${location.id}`;
      if (seenStudios.has(key)) continue;
      seenStudios.add(key);
      liveStudios.push(studioFromLocation(location, brand.slug));
    }

    const locationId = brand.locationIds[0] || (usable[0] ? String(usable[0].id) : "");
    if (!locationId) continue;

    if (config.capabilities.packages) {
      try {
        const combos = await client.listCombos(brand.slug);
        for (const item of combos) {
          const product = productFromItem(item, "combo", brand.slug, locationId);
          const key = productKey(product);
          if (seenProducts.has(key)) continue;
          seenProducts.add(key);
          liveProducts.push(product);
        }
      } catch {
        // El fallback es el catalogo declarado en config.
      }
    }

    if (config.capabilities.memberships) {
      try {
        const memberships = await client.listMemberships(brand.slug);
        for (const item of memberships) {
          const product = productFromItem(item, "membership", brand.slug, locationId);
          const key = productKey(product);
          if (seenProducts.has(key)) continue;
          seenProducts.add(key);
          liveProducts.push(product);
        }
      } catch {
        // El fallback es el catalogo declarado en config.
      }
    }
  }

  const allow = new Set(config.catalog.products.map(productKey));
  const allowlisted = allow.size ? liveProducts.filter((product) => allow.has(productKey(product))) : [];
  const uniqueLive = dedupeByTypeId(liveProducts);
  const products = allowlisted.length
    ? allowlisted
    : uniqueLive.length
      ? uniqueLive
      : config.catalog.products;
  const studios = config.studios.length ? [...config.studios, ...liveStudios.filter((studio) => {
    return !config.studios.some((known) => known.locationId === studio.locationId && known.brandSlug === studio.brandSlug);
  })] : liveStudios;

  return {
    ...config,
    studios,
    catalog: {
      ...config.catalog,
      products,
      live: true,
    },
  };
}
