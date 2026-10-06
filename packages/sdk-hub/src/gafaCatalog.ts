/** Catálogo público de gafa.fit para el picker del Hub. Sin OAuth: header GAFAFIT-COMPANY. */

export const CATALOG_KINDS = ["combo", "membership", "product"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export type GafaCatalogItem = {
  type: CatalogKind;
  id: number;
  name: string;
  price?: number;
  priceLabel?: string;
  brandId?: number;
  brandSlug: string;
  brandName: string;
  /** Activo, pero oculto del Home / front. El picker del Hub igual lo muestra. */
  hiddenFromHome?: boolean;
};

export type GafaBrand = {
  id: number;
  slug: string;
  name: string;
};

export type GafaCatalog = {
  items: GafaCatalogItem[];
  brands: GafaBrand[];
  warnings: string[];
};

const API_BASE: Record<string, string> = {
  production: "https://buq.partners",
  prod: "https://buq.partners",
  staging: "https://buq.com.mx",
  stage: "https://buq.com.mx",
  development: "https://buq.technology",
  dev: "https://buq.technology",
};

const MAX_PAGES = 8;
const PAGE_SIZE = 50;
const REQUEST_MS = 8_000;

type FetchLike = typeof fetch;

export function gafaApiBaseUrl(config: Record<string, unknown> | null | undefined): string {
  const explicit = typeof config?.GAFA_FIT_URL === "string" ? config.GAFA_FIT_URL.trim() : "";
  if (explicit) return explicit.replace(/\/+$/, "");
  const env = String(config?.BUQ_ENV ?? "production").trim().toLowerCase();
  return API_BASE[env] ?? API_BASE.production;
}

export function preferredBrandId(config: Record<string, unknown> | null | undefined): number | null {
  const n = Number(config?.BRAND_ID);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function fetchGafaCatalog(input: {
  companyId: number;
  apiBaseUrl: string;
  brandId?: number | null;
  fetchImpl?: FetchLike;
}): Promise<GafaCatalog> {
  const baseUrl = input.apiBaseUrl.replace(/\/+$/, "");
  const fetchImpl = input.fetchImpl ?? fetch;
  const warnings: string[] = [];
  const brands = await listBrands(baseUrl, input.companyId, fetchImpl);
  const selected =
    input.brandId && brands.some((brand) => brand.id === input.brandId)
      ? brands.filter((brand) => brand.id === input.brandId)
      : brands;

  const items: GafaCatalogItem[] = [];
  const seen = new Set<string>();
  for (const brand of selected) {
    const combos = await listKind(baseUrl, input.companyId, brand, "combo", ["/combos"], fetchImpl, warnings);
    const memberships = await listKind(
      baseUrl,
      input.companyId,
      brand,
      "membership",
      ["/membership"],
      fetchImpl,
      warnings,
    );
    const products = await listKind(
      baseUrl,
      input.companyId,
      brand,
      "product",
      ["/product", "/products", "/producto", "/productos"],
      fetchImpl,
      warnings,
    );
    for (const item of [...combos, ...memberships, ...products]) {
      const key = `${item.type}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  items.sort(compareCatalogItems);
  if (!items.some((item) => item.type === "product")) {
    warnings.push(
      "gafa.fit no publica un listado de productos de tienda para este estudio (ropa, merch, etc.). No es un filtro del Home: el endpoint no existe, así que el Hub no puede traerlos. Paquetes y membresías sí salen aunque estén ocultos en el sitio.",
    );
  }
  return { items, brands: selected, warnings: unique(warnings) };
}

function compareCatalogItems(a: GafaCatalogItem, b: GafaCatalogItem): number {
  const type = CATALOG_KINDS.indexOf(a.type) - CATALOG_KINDS.indexOf(b.type);
  if (type !== 0) return type;
  const brand = a.brandName.localeCompare(b.brandName, "es");
  if (brand !== 0) return brand;
  return a.name.localeCompare(b.name, "es");
}

async function listBrands(baseUrl: string, companyId: number, fetchImpl: FetchLike): Promise<GafaBrand[]> {
  const pages = await paginate<RawBrand>(baseUrl, companyId, "/brand", fetchImpl);
  return pages
    .map(normalizeBrand)
    .filter((brand): brand is GafaBrand => Boolean(brand));
}

async function listKind(
  baseUrl: string,
  companyId: number,
  brand: GafaBrand,
  type: CatalogKind,
  suffixes: string[],
  fetchImpl: FetchLike,
  warnings: string[],
): Promise<GafaCatalogItem[]> {
  let lastStatus = 0;
  for (const suffix of suffixes) {
    try {
      const rows = await paginate<RawCatalogItem>(
        baseUrl,
        companyId,
        `/brand/${encodeURIComponent(brand.slug)}${suffix}`,
        fetchImpl,
        { only_actives: "true" },
      );
      return rows
        .map((row) => normalizeItem(row, type, brand))
        .filter((item): item is GafaCatalogItem => Boolean(item));
    } catch (error) {
      lastStatus = error instanceof CatalogHttpError ? error.status : lastStatus;
      if (error instanceof CatalogHttpError && error.status === 404) continue;
      warnings.push(`No pude leer ${kindLabel(type).toLowerCase()} de ${brand.name}.`);
      return [];
    }
  }
  if (type === "product" && (lastStatus === 404 || lastStatus === 0)) return [];
  if (lastStatus === 404) warnings.push(`${kindLabel(type)} de ${brand.name}: no hay endpoint público.`);
  return [];
}

async function paginate<T>(
  baseUrl: string,
  companyId: number,
  path: string,
  fetchImpl: FetchLike,
  extra: Record<string, string> = {},
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const payload = await gafaGet(baseUrl, companyId, path, { ...extra, page: String(page), per_page: String(PAGE_SIZE) }, fetchImpl);
    out.push(...asList<T>(payload));
    const meta = laravelPageMeta(payload);
    lastPage = meta?.lastPage ?? 1;
    page += 1;
  } while (page <= lastPage && page <= MAX_PAGES);
  return out;
}

async function gafaGet(
  baseUrl: string,
  companyId: number,
  path: string,
  params: Record<string, string>,
  fetchImpl: FetchLike,
): Promise<unknown> {
  const url = new URL(`${baseUrl}/api${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetchImpl(url.toString(), {
    headers: {
      Accept: "application/json",
      "GAFAFIT-COMPANY": String(companyId),
    },
    signal: AbortSignal.timeout(REQUEST_MS),
  });
  if (!response.ok) throw new CatalogHttpError(response.status);
  return response.json();
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function laravelPageMeta(payload: unknown): { page: number; lastPage: number } | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const obj = payload as Record<string, unknown>;
  const meta =
    obj.meta && typeof obj.meta === "object" && !Array.isArray(obj.meta) ? (obj.meta as Record<string, unknown>) : obj;
  const page = Number(meta.current_page ?? obj.current_page);
  const lastPage = Number(meta.last_page ?? obj.last_page);
  if (!Number.isFinite(page) || !Number.isFinite(lastPage) || lastPage < 1) return null;
  return { page, lastPage };
}

type RawBrand = { id?: unknown; name?: unknown; slug?: unknown; status?: unknown };
type RawCatalogItem = {
  id?: unknown;
  name?: unknown;
  price?: unknown;
  price_final?: unknown;
  hide_in_front?: unknown;
  hide_in_home?: unknown;
};

function normalizeBrand(raw: RawBrand): GafaBrand | null {
  const id = Number(raw.id);
  const slug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : slug;
  const status = typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "active";
  if (!Number.isFinite(id) || id <= 0 || !slug) return null;
  if (status && status !== "active") return null;
  return { id, slug, name: name || slug };
}

function normalizeItem(raw: RawCatalogItem, type: CatalogKind, brand: GafaBrand): GafaCatalogItem | null {
  // El picker es backoffice: trae también lo oculto del Home / front.
  const id = Number(raw.id);
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!Number.isFinite(id) || id <= 0 || !name) return null;
  const price = moneyNumber(raw.price_final) ?? moneyNumber(raw.price);
  return {
    type,
    id,
    name,
    price,
    priceLabel: price == null ? undefined : formatPrice(price),
    brandId: brand.id,
    brandSlug: brand.slug,
    brandName: brand.name,
    hiddenFromHome: truthy(raw.hide_in_front) || truthy(raw.hide_in_home),
  };
}

function moneyNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function formatPrice(amount: number): string {
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `$${rounded}`;
}

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function kindLabel(type: CatalogKind): string {
  if (type === "combo") return "Paquetes";
  if (type === "membership") return "Membresías";
  return "Productos";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

class CatalogHttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`gafa.fit ${status}`);
    this.status = status;
  }
}
