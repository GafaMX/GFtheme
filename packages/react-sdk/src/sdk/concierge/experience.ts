import type {
  ConciergeActionData,
  ConciergeCatalogGroup,
  ConciergePartnerConfig,
  ConciergeProduct,
} from "./contracts";
import { conciergeProducts } from "./products";

export type CatalogFilter = {
  locationId?: string;
  groupId?: string;
};

export type OpeningChip = {
  label: string;
  action: ConciergeActionData;
};

const DEFAULT_OPENING: OpeningChip[] = [
  { label: "Reservar", action: { kind: "reservar" } },
  { label: "Comprar paquetes", action: { kind: "comprar" } },
  { label: "Mi cuenta", action: { kind: "cuenta" } },
  { label: "Horarios de hoy", action: { kind: "horarios_hoy" } },
];

export function todayIso(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function actionAllowed(config: ConciergePartnerConfig, action: ConciergeActionData): boolean {
  if (action.kind === "reservar" || action.kind === "horarios_hoy") {
    return config.capabilities.schedule;
  }
  if (action.kind === "comprar" || action.kind === "buy_package") {
    return config.capabilities.packages;
  }
  if (action.kind === "cuenta") return config.capabilities.account;
  if (action.kind === "whatsapp") return config.capabilities.whatsapp;
  return true;
}

export function openingChips(config: ConciergePartnerConfig): OpeningChip[] {
  const configured = config.experience?.openingActions;
  const source = configured?.length ? configured : DEFAULT_OPENING;
  return source.filter((chip) => actionAllowed(config, chip.action));
}

export function catalogGroups(config: ConciergePartnerConfig): ConciergeCatalogGroup[] {
  const products = conciergeProducts(config);
  const configured = config.experience?.groups ?? [];
  if (configured.length) {
    return configured.filter((group) => products.some((product) => productMatchesGroup(product, group)));
  }
  const inferred: ConciergeCatalogGroup[] = [];
  if (products.some((product) => product.type === "combo")) {
    inferred.push({ id: "combo", label: "Paquetes", match: { types: ["combo"] } });
  }
  if (config.capabilities.memberships && products.some((product) => product.type === "membership")) {
    inferred.push({ id: "membership", label: "Membresías", match: { types: ["membership"] } });
  }
  return inferred;
}

export function productMatchesGroup(product: ConciergeProduct, group: ConciergeCatalogGroup): boolean {
  const match = group.match;
  if (!match) return true;
  if (match.types?.length && !match.types.includes(product.type)) return false;
  if (match.locationIds?.length && !match.locationIds.includes(product.locationId)) return false;
  if (match.productIds?.length && !match.productIds.includes(product.id)) return false;
  if (match.nameIncludes?.length) {
    const name = product.name.toLowerCase();
    if (!match.nameIncludes.some((needle) => name.includes(needle.toLowerCase()))) return false;
  }
  return true;
}

export function filterCatalogProducts(config: ConciergePartnerConfig, filter: CatalogFilter = {}): ConciergeProduct[] {
  const groups = catalogGroups(config);
  const activeGroup = filter.groupId ? groups.find((group) => group.id === filter.groupId) : undefined;
  return conciergeProducts(config).filter((product) => {
    if (filter.locationId && product.locationId !== filter.locationId) return false;
    if (activeGroup && !productMatchesGroup(product, activeGroup)) return false;
    return true;
  });
}

export function showLocationSwitcher(config: ConciergePartnerConfig): boolean {
  if (config.experience?.locationSwitcher === false) return false;
  return config.studios.length > 1;
}

export function packagesIntro(config: ConciergePartnerConfig): string {
  return config.experience?.copy?.packagesIntro ?? "Estos son los paquetes disponibles:";
}

export function todayIntro(config: ConciergePartnerConfig): string {
  return config.experience?.copy?.todayIntro ?? "Horarios de hoy";
}

export function emptyCatalogCopy(config: ConciergePartnerConfig): string {
  return config.experience?.copy?.emptyCatalog ?? config.copy.fallback;
}

export function allLocationsLabel(config: ConciergePartnerConfig): string {
  return config.experience?.copy?.allLocations ?? "Todas";
}
