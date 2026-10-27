import { afterEach, describe, expect, it } from "vitest";
import { useCartStore } from "../cart/cartStore";
import { subscribeCartAdds, trackCheckoutOpenedWhenReady } from "./cartEvents";
import type { TrackInput } from "./events";

function addPackage(overrides: Partial<{ id: number; price: number; currency: string }> = {}) {
  const id = overrides.id ?? 973;
  const price = overrides.price ?? 330;
  useCartStore.getState().addItem({
    id,
    type: "combo",
    name: "10 clases",
    price,
    priceLabel: `$${price}`,
    brandSlug: "fitspin",
    raw: { currency: overrides.currency ?? "MXN" },
  });
}

afterEach(() => {
  useCartStore.setState({ lines: [], reservation: null });
  localStorage.removeItem("gafa-sdk:cart-v1");
});

describe("checkout vs carrito", () => {
  it("con preselect: add_to_cart primero, initiate_checkout con el carrito real", () => {
    const events: TrackInput[] = [];
    const track = (input: TrackInput) => {
      events.push(input);
    };
    const stopAdds = subscribeCartAdds(track);
    const stopWait = trackCheckoutOpenedWhenReady(track, { type: "combo", id: 973 });

    expect(events).toEqual([]);

    addPackage({ id: 973, price: 330, currency: "MXN" });

    expect(events.map((row) => row.event)).toEqual(["cart.item_added", "checkout.opened"]);
    const opened = events[1];
    expect(opened.props).toMatchObject({
      value: 330,
      currency: "MXN",
      content_ids: ["973"],
      content_type: "product",
      num_items: 1,
    });
    expect(opened.props?.value).not.toBe(0);
    expect(opened.props?.num_items).not.toBe(0);

    stopAdds();
    stopWait();
  });

  it("sin preselect abre ya con el carrito actual", () => {
    addPackage({ id: 10, price: 1400, currency: "EUR" });
    const events: TrackInput[] = [];
    trackCheckoutOpenedWhenReady((input) => events.push(input));
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("checkout.opened");
    expect(events[0].props).toMatchObject({
      value: 1400,
      currency: "EUR",
      content_ids: ["10"],
      num_items: 1,
    });
  });
});
