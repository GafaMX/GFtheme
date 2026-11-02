import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CatalogItem, GafaClient } from "../client/types";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";

const muestra: CatalogItem = {
  id: 88,
  name: "Clase muestra",
  price: 0,
  priceFinal: 0,
  type: "combo",
  reservationsMax: 1,
  raw: { id: 88, name: "Clase muestra", reservations_max: 1 },
};

const pack: CatalogItem = {
  id: 12,
  name: "5 Clases",
  price: 1350,
  priceFinal: 1350,
  type: "combo",
};

function mockClient(combos: CatalogItem[]): GafaClient {
  return {
    listBrands: async () => [{ id: 1, name: "Fitspin Cancún", slug: "fitspin-cancun" }],
    listLocations: async () => [{ id: 200, name: "Cancún", slug: "cancun", brandSlug: "fitspin-cancun" }],
    listCombos: async () => combos,
    listMemberships: async () => [],
    listProducts: async () => [],
    getProfile: async () => null,
  } as unknown as GafaClient;
}

function renderShop(client: GafaClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutModal
        client={client}
        brandSlug="fitspin-cancun"
        locationSlug="cancun"
        skipCatalog={false}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

function openCart() {
  fireEvent.click(screen.getByRole("button", { name: /ver productos del carrito/i }));
}

describe("CheckoutModal tope de cantidad", () => {
  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
  });

  it("con reservations_max=1 oculta el stepper y no deja agregar otro", async () => {
    const line: CartLine = {
      key: "fitspin-cancun:combo:88",
      id: 88,
      type: "combo",
      name: "Clase muestra",
      price: 0,
      priceLabel: "$0",
      amount: 1,
      brandSlug: "fitspin-cancun",
      locationSlug: "cancun",
      raw: { reservations_max: 1 },
    };
    useCartStore.setState({ lines: [line], reservation: null });
    renderShop(mockClient([muestra]));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /en el carrito/i })).toBeTruthy();
    });
    expect((screen.getByRole("button", { name: /en el carrito/i }) as HTMLButtonElement).disabled).toBe(true);

    openCart();
    expect(screen.queryByRole("button", { name: "Agregar uno" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar uno" })).toBeNull();
    expect(screen.getByLabelText("Cantidad de Clase muestra").textContent).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: /en el carrito/i }));
    expect(useCartStore.getState().lines[0]?.amount).toBe(1);
  });

  it("con tope 3 desactiva + al llegar y addItem no pasa de 3", async () => {
    const line: CartLine = {
      key: "fitspin-cancun:combo:12",
      id: 12,
      type: "combo",
      name: "5 Clases",
      price: 1350,
      priceLabel: "$1,350",
      amount: 3,
      brandSlug: "fitspin-cancun",
      locationSlug: "cancun",
      raw: { reservations_max: 3 },
    };
    useCartStore.setState({ lines: [line], reservation: null });
    renderShop(
      mockClient([{ ...pack, reservationsMax: 3, raw: { reservations_max: 3 } }]),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /máximo \(3\)/i })).toBeTruthy();
    });
    openCart();
    expect((screen.getByRole("button", { name: "Agregar uno" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Agregar uno" }));
    expect(useCartStore.getState().lines[0]?.amount).toBe(3);
  });

  it("sin tope el stepper suma", async () => {
    const line: CartLine = {
      key: "fitspin-cancun:combo:12",
      id: 12,
      type: "combo",
      name: "5 Clases",
      price: 1350,
      priceLabel: "$1,350",
      amount: 1,
      brandSlug: "fitspin-cancun",
      locationSlug: "cancun",
    };
    useCartStore.setState({ lines: [line], reservation: null });
    renderShop(mockClient([pack]));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /agregar otro \(1\)/i })).toBeTruthy();
    });
    openCart();
    fireEvent.click(screen.getByRole("button", { name: "Agregar uno" }));
    expect(useCartStore.getState().lines[0]?.amount).toBe(2);
  });
});
