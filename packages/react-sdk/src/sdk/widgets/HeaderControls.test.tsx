import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HeaderControls } from "./HeaderControls";
import { useCartStore } from "../cart/cartStore";
import { ThemeProvider } from "../theme/theme";
import type { GafaClient } from "../client/types";

function signedInClient(): GafaClient {
  return {
    getProfile: async () => ({ id: 9, name: "Ana", email: "ana@fitspin.mx", firstName: "Ana" }),
  } as GafaClient;
}

describe("HeaderControls carrito", () => {
  afterEach(() => {
    cleanup();
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

  it("dice Entrar sin sesión y abre la cuenta", () => {
    const onOpenAccount = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <HeaderControls onOpenAccount={onOpenAccount} onOpenCart={() => undefined} />
      </QueryClientProvider>,
    );
    const account = screen.getByRole("button", { name: /^entrar$/i });
    expect(account.className).toContain("gafa-header-account");
    expect(account.querySelector(".gafa-header-account__label")?.textContent).toBe("Entrar");
    expect(account.querySelector("svg")).toBeTruthy();
    expect(account.querySelector(".gafa-header-account__dot")).toBeNull();
    fireEvent.click(account);
    expect(onOpenAccount).toHaveBeenCalledTimes(1);
  });

  it("dice Mi cuenta con sesión y muestra el puntito", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <HeaderControls
          client={signedInClient()}
          onOpenAccount={() => undefined}
          onOpenCart={() => undefined}
        />
      </QueryClientProvider>,
    );
    const account = await waitFor(() => {
      const button = screen.getByRole("button", { name: /^mi cuenta$/i });
      expect(button.querySelector(".gafa-header-account__label")?.textContent).toBe("Mi cuenta");
      return button;
    });
    expect(account.querySelector(".gafa-header-account__dot")).toBeTruthy();
    expect(account.querySelector("svg")).toBeTruthy();
  });

  it("THEME.headerControls pinta las vars en el wrapper y no toca el carrito", () => {
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
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider
          theme={{
            headerControls: {
              fontSize: "11px",
              fontWeight: 500,
              background: "#8D6363",
              color: "#FFFFFF",
              height: "48px",
            },
          }}
        >
          <HeaderControls onOpenAccount={() => undefined} onOpenCart={() => undefined} />
        </ThemeProvider>
      </QueryClientProvider>,
    );
    const root = container.querySelector<HTMLElement>(".gafa-sdk");
    expect(root?.style.getPropertyValue("--gafa-header-account-font-size")).toBe("11px");
    expect(root?.style.getPropertyValue("--gafa-header-account-background")).toBe("#8D6363");
    expect(root?.style.getPropertyValue("--gafa-header-account-height")).toBe("48px");
    expect(container.querySelector(".gafa-header-account")).toBeTruthy();
    expect(container.querySelector(".gafa-header-cart")).toBeTruthy();
  });
});
