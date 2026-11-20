import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  paymentMethods: [{ id: 6, name: "Stripe", slug: "stripe", gafapayId: 4, order: 0 }],
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

function renderPay() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutModal
        client={mockClient()}
        brandSlug="fitspin-cancun"
        locationSlug="cancun"
        skipCatalog
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("CheckoutModal terms prompt", () => {
  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
    localStorage.removeItem("gafa-sdk:cart-v1");
    vi.restoreAllMocks();
  });

  it("al pagar sin términos abre un diálogo, no deja el botón muerto", async () => {
    const nativeAlert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    useCartStore.setState({ lines: [cartLine], reservation: null });
    renderPay();

    await waitFor(() => screen.getByRole("checkbox"));
    const pay = screen.getByRole("button", { name: /^pagar /i });
    const termsBox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(pay.hasAttribute("disabled")).toBe(false);
    expect(termsBox.checked).toBe(false);

    fireEvent.click(pay);

    expect(await screen.findByRole("alertdialog", { name: /acepta los términos/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /aceptar y pagar/i })).toBeTruthy();
    expect(nativeAlert).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog", { name: /acepta los términos/i })).toBeNull();
    });
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("Aceptar y pagar marca los términos", async () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    renderPay();

    await waitFor(() => screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^pagar /i }));
    fireEvent.click(await screen.findByRole("button", { name: /aceptar y pagar/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog", { name: /acepta los términos/i })).toBeNull();
      expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    });
  });
});
