import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CatalogItem, GafaClient } from "../client/types";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";

const cartLine: CartLine = {
  key: "fitspin-cancun:combo:1",
  id: 1,
  type: "combo",
  name: "5 Clases Cancún",
  price: 1350,
  priceLabel: "$1,350",
  amount: 1,
  brandSlug: "fitspin-cancun",
  locationSlug: "cancun",
  expirationLabel: "Expira en 60 días",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mockClient(combos: Promise<CatalogItem[]>): GafaClient {
  return {
    listBrands: async () => [{ id: 1, name: "Fitspin Cancún", slug: "fitspin-cancun" }],
    listLocations: async () => [{ id: 200, name: "Cancún", slug: "cancun", brandSlug: "fitspin-cancun" }],
    listCombos: async () => combos,
    listMemberships: async () => [],
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

describe("CheckoutModal catalog loading", () => {
  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
  });

  it("muestra skeleton y el pedido, no el vacio de 'esta clase no tiene paquetes'", async () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    const pending = deferred<CatalogItem[]>();
    renderShop(mockClient(pending.promise));

    expect(screen.queryByText(/esta clase no tiene paquetes/i)).toBeNull();
    expect(screen.queryByText(/no hay paquetes disponibles/i)).toBeNull();
    expect(screen.getByText(/cargando catálogo/i)).toBeTruthy();
    expect(screen.getAllByText("5 Clases Cancún").length).toBeGreaterThan(0);

    pending.resolve([
      {
        id: 1,
        name: "5 Clases Cancún",
        type: "combo",
        price: 1350,
        priceFinal: 1350,
        priceLabel: "$1,350",
      },
    ]);

    await waitFor(() => {
      expect(screen.queryByText(/cargando catálogo/i)).toBeNull();
      expect(screen.getByRole("button", { name: /agregar otro/i })).toBeTruthy();
    });
    expect(screen.queryByText(/esta clase no tiene paquetes/i)).toBeNull();
  });
});
