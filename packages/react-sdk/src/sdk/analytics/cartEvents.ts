import { cartSubtotal, useCartStore, type CartLine } from "../cart/cartStore";
import type { CartLineType } from "../client/types";
import { currencyFromUnknown, resolvePixelCurrency } from "./pixels/map";
import type { TrackInput } from "./events";

export type CartPreselect = { type: CartLineType; id: number };

function currencyFromLine(line: CartLine): string | undefined {
  return (
    currencyFromUnknown(line.raw?.currency) ??
    currencyFromUnknown(line.raw?.code3) ??
    currencyFromUnknown(line.raw)
  );
}

export function cartHasItem(
  preselect: CartPreselect,
  lines: CartLine[] = useCartStore.getState().lines,
): boolean {
  return lines.some((line) => line.type === preselect.type && line.id === preselect.id);
}

export function cartCommerceProps(lines: CartLine[] = useCartStore.getState().lines): Record<string, unknown> {
  const content_ids = lines.map((line) => String(line.id));
  const num_items = lines.reduce((sum, line) => sum + line.amount, 0);
  const currency = resolvePixelCurrency(lines.map(currencyFromLine).find(Boolean));
  const props: Record<string, unknown> = {
    content_type: "product",
    num_items,
    value: cartSubtotal(lines),
    currency,
  };
  if (content_ids.length) props.content_ids = content_ids;
  return props;
}

export function subscribeCartAdds(track: (input: TrackInput) => void): () => void {
  const amounts = new Map<string, number>();
  for (const line of useCartStore.getState().lines) amounts.set(line.key, line.amount);

  return useCartStore.subscribe((state) => {
    try {
      for (const line of state.lines) {
        const prev = amounts.get(line.key) ?? 0;
        if (line.amount > prev) {
          const added = line.amount - prev;
          track({
            event: "cart.item_added",
            widget: "checkout",
            props: {
              content_ids: [String(line.id)],
              content_type: "product",
              num_items: added,
              value: line.price * added,
              item_id: line.id,
              item_type: line.type,
              currency: resolvePixelCurrency(currencyFromLine(line)),
            },
          });
        }
        amounts.set(line.key, line.amount);
      }
      for (const key of [...amounts.keys()]) {
        if (!state.lines.some((line) => line.key === key)) amounts.delete(key);
      }
    } catch {
      // el carrito no debe romper
    }
  });
}

export function emitCheckoutOpened(track: (input: TrackInput) => void): void {
  track({
    event: "checkout.opened",
    widget: "checkout",
    props: cartCommerceProps(),
  });
}

/**
 * `initiate_checkout` espera a que el preselect esté en el carrito para ir
 * DESPUÉS de `add_to_cart` y llevar value/currency/items reales.
 * Sin preselect (o si ya está en el carrito) dispara ya.
 */
export function trackCheckoutOpenedWhenReady(
  track: (input: TrackInput) => void,
  preselect?: CartPreselect | null,
): () => void {
  if (!preselect || cartHasItem(preselect)) {
    emitCheckoutOpened(track);
    return () => undefined;
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    unsub();
    emitCheckoutOpened(track);
  };

  const unsub = useCartStore.subscribe((state) => {
    if (cartHasItem(preselect, state.lines)) finish();
  });

  return () => {
    done = true;
    unsub();
  };
}
