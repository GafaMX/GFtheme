import { resolveMoneyCurrency } from "../../cart/money";
import type { Brand } from "../../client/types";

const FALLBACK = "MXN";

/** ISO de un valor suelto. No rellena default: eso es `resolvePixelCurrency`. */
export function currencyFromUnknown(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const money = resolveMoneyCurrency(raw);
    return money?.code || (raw.trim() ? raw.trim().toUpperCase() : undefined);
  }
  const money = resolveMoneyCurrency(raw);
  return money?.code;
}

let bound: string | undefined;

/** Misma moneda que usa el SDK para pintar precios (`brand.currency` / checkout). */
export function bindBrandCurrency(raw: unknown): void {
  const code = currencyFromUnknown(raw);
  if (code) bound = code;
}

export function bindCurrencyFromBrands(brands: Array<Pick<Brand, "currency">> | null | undefined): void {
  if (!brands?.length) return;
  const withCode = brands.find((brand) => currencyFromUnknown(brand.currency));
  bindBrandCurrency(withCode?.currency ?? brands[0]?.currency);
}

export function peekBrandCurrency(): string | undefined {
  return bound;
}

/** Evento → marca ligada → MXN. Siempre un ISO para comercio. */
export function resolvePixelCurrency(raw?: unknown): string {
  return currencyFromUnknown(raw) ?? bound ?? FALLBACK;
}

export function resetBrandCurrency(): void {
  bound = undefined;
}

export const resetBrandCurrencyForTests = resetBrandCurrency;
