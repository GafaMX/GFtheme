import type { CartLineType } from "../client/types";

/**
 * Clases Eloquent que el fancy v1 pone en cada linea del carrito y en los
 * `lineItems` de GafaPay (`App\Models\Combos\Combos`, etc.).
 *
 * v2 mandaba `"combo"` / `"membership"` / `"product"`. GafaPay igual cobra,
 * pero gafa.fit resuelve el pago con `product_type` y explota (500 "Server
 * Error"): Stripe ya cobró y Buq no otorga créditos.
 */
export const GAFA_FIT_PRODUCT_TYPE: Record<CartLineType, string> = {
  combo: "App\\Models\\Combos\\Combos",
  membership: "App\\Models\\Membership\\Membership",
  product: "App\\Models\\Products\\Product",
};

export type GafaFitPurchaseLine = {
  id: number;
  type: CartLineType;
  amount: number;
  name?: string;
  price?: number;
  companiesId?: number;
};

/** Item de `cart` / `combo` / `membership` / `product` del fancy v1. */
export type GafaFitCartItem = {
  id: number;
  type: CartLineType;
  amount: number;
  name?: string;
  price_final?: number;
  product_type: string;
  companies_id?: number;
};

export function gafaFitProductType(type: CartLineType): string {
  return GAFA_FIT_PRODUCT_TYPE[type];
}

export function toGafaFitCartItem(line: GafaFitPurchaseLine): GafaFitCartItem {
  const item: GafaFitCartItem = {
    id: line.id,
    type: line.type,
    amount: line.amount,
    product_type: gafaFitProductType(line.type),
  };
  if (line.name != null) item.name = line.name;
  if (line.price != null) item.price_final = line.price;
  if (line.companiesId != null) item.companies_id = line.companiesId;
  return item;
}

export function partitionGafaFitCart(lines: GafaFitPurchaseLine[]): {
  cart: GafaFitCartItem[];
  combo: GafaFitCartItem[];
  membership: GafaFitCartItem[];
  product: GafaFitCartItem[];
  combosId: number[];
  combosAmounts: number[];
  membershipsId: number[];
  membershipsAmounts: number[];
  productsId: number[];
  productsAmounts: number[];
} {
  const cart = lines.map(toGafaFitCartItem);
  const combo = cart.filter((item) => item.type === "combo");
  const membership = cart.filter((item) => item.type === "membership");
  const product = cart.filter((item) => item.type === "product");
  return {
    cart,
    combo,
    membership,
    product,
    combosId: combo.map((item) => item.id),
    combosAmounts: combo.map((item) => item.amount),
    membershipsId: membership.map((item) => item.id),
    membershipsAmounts: membership.map((item) => item.amount),
    productsId: product.map((item) => item.id),
    productsAmounts: product.map((item) => item.amount),
  };
}
