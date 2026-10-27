import { cartSubtotal, useCartStore, type CartLine } from "../cart/cartStore";
import { currencyFromUnknown } from "./pixels/map";
import type { TrackInput } from "./events";

function currencyFromLine(line: CartLine): string | undefined {
  return currencyFromUnknown(line.raw?.currency) ?? currencyFromUnknown(line.raw);
}

export function cartCommerceProps(lines: CartLine[] = useCartStore.getState().lines): Record<string, unknown> {
  const content_ids = lines.map((line) => String(line.id));
  const num_items = lines.reduce((sum, line) => sum + line.amount, 0);
  const currency = lines.map(currencyFromLine).find(Boolean);
  const props: Record<string, unknown> = {
    content_type: "product",
    num_items,
    value: cartSubtotal(lines),
  };
  if (content_ids.length) props.content_ids = content_ids;
  if (currency) props.currency = currency;
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
          const currency = currencyFromLine(line);
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
              ...(currency ? { currency } : {}),
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
