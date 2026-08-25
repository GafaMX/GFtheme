import { afterEach, describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { HeaderControls } from "./HeaderControls";
import { useCartStore } from "../cart/cartStore";

describe("HeaderControls carrito", () => {
  afterEach(() => {
    useCartStore.setState({ lines: [], reservation: null });
    localStorage.removeItem("gafa-sdk:cart-v1");
  });

  it("muestra un círculo con badge cuando hay items", () => {
    useCartStore.setState({
      lines: [
        {
          key: "fitspin:combo:1",
          id: 1,
          type: "combo",
          name: "Pack",
          price: 100,
          priceLabel: "$100",
          amount: 1,
          brandSlug: "fitspin",
        },
      ],
      reservation: null,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <HeaderControls onOpenAccount={() => undefined} onOpenCart={() => undefined} />
      </QueryClientProvider>,
    );

    const cart = screen.getByRole("button", { name: /tu carrito, 1 artículo/i });
    expect(cart.className).toContain("gafa-header-cart");
    expect(cart.querySelector(".gafa-header-cart__count")?.textContent).toBe("1");
  });
});
