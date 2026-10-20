import type { ConciergePartnerConfig, ConciergeProduct } from "./contracts";

export function conciergeProducts(config: ConciergePartnerConfig): ConciergeProduct[] {
  if (!config.capabilities.packages) return [];
  return config.catalog.products.filter(
    (product) => product.type !== "membership" || config.capabilities.memberships,
  );
}
