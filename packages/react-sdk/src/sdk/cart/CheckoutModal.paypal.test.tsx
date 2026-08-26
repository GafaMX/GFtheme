import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CheckoutConfig, GafaClient } from "../client/types";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";

const cartLine: CartLine = {
  key: "fitspin-cancun:combo:1",
  id: 1,
  type: "combo",
  name: "SCULPT",
  price: 275,
  priceLabel: "$275",
  amount: 1,
  brandSlug: "fitspin-cancun",
  locationSlug: "cancun",
};

const checkoutConfig: CheckoutConfig = {
  brandSlug: "fitspin-cancun",
  locationSlug: "cancun",
  currency: { prefix: "$", suffix: "MXN", code: "MXN" },
  paymentMethods: [
    { id: 6, name: "Stripe", slug: "stripe", gafapayId: 4, order: 0 },
    { id: 3, name: "PayPal", slug: "paypal", gafapayId: 2, order: 1 },
  ],
  termsConditionsLink: "https://fitspin.example/terminos",
  giftCardsEnabled: false,
  discountCodesEnabled: false,
  canRedeemStoreCredit: false,
  combos: [],
  memberships: [],
  products: [],
  urls: {
    reservation: "/reservate",
    initialPurchase: "/buy",
    initialPurchaseStatus: "/buy-status",
  },
};

function mockClient(): GafaClient {
  return {
    listBrands: async () => [{ id: 1, name: "Fitspin Cancún", slug: "fitspin-cancun" }],
    listLocations: async () => [{ id: 200, name: "Cancún", slug: "cancun", brandSlug: "fitspin-cancun" }],
    listCombos: async () => [],
    listMemberships: async () => [],
    getProfile: async () => ({ id: 9, name: "Ana", email: "ana@fitspin.mx", firstName: "Ana" }),
    getCheckoutConfig: async () => checkoutConfig,
  } as unknown as GafaClient;
}

describe("CheckoutModal PayPal panel", () => {
  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
    localStorage.removeItem("gafa-sdk:cart-v1");
  });

  it("envuelve el botón de GafaPay con copy, sin dejarlo en una caja vacía", async () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })}
      >
        <CheckoutModal
          client={mockClient()}
          brandSlug="fitspin-cancun"
          locationSlug="cancun"
          skipCatalog
          onClose={() => undefined}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(await waitFor(() => screen.getByRole("tab", { name: /paypal/i })));

    expect(await screen.findByText("Pagar con PayPal")).toBeTruthy();
    expect(screen.getByText(/te llevamos a paypal/i)).toBeTruthy();
    const mount = document.querySelector(".gafa-checkout-paymount");
    expect(mount?.getAttribute("data-method")).toBe("paypal");
    expect(document.querySelector(".gafa-checkout-paymount .gafa-pay-native")).toBeTruthy();
    expect(document.querySelector(".gafa-checkout__paypal-cta")).toBeNull();
    expect(screen.getByRole("button", { name: /pagar \$/i })).toBeTruthy();
    expect(screen.queryByText(/completa el pago con el botón de paypal/i)).toBeNull();
  });

  it("oculta PayPal si el carrito trae una membresía", async () => {
    useCartStore.setState({
      lines: [
        {
          ...cartLine,
          key: "fitspin-cancun:membership:8",
          id: 8,
          type: "membership",
          name: "Unlimited",
        },
      ],
      reservation: null,
    });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })}
      >
        <CheckoutModal
          client={mockClient()}
          brandSlug="fitspin-cancun"
          locationSlug="cancun"
          skipCatalog
          onClose={() => undefined}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pagar/i })).toBeTruthy();
    });
    expect(screen.queryByRole("tab", { name: /paypal/i })).toBeNull();
    expect(document.querySelector(".gafa-checkout-paymount")?.getAttribute("data-method")).not.toBe(
      "paypal",
    );
    expect(screen.queryByText(/te llevamos a paypal/i)).toBeNull();
  });
});
