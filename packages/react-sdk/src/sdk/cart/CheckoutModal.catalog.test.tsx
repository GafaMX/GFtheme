import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CatalogItem, GafaClient, Meeting } from "../client/types";
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

function mockClient(
  combos: Promise<CatalogItem[]>,
  extras?: { products?: CatalogItem[]; memberships?: CatalogItem[] },
): GafaClient {
  return {
    listBrands: async () => [{ id: 1, name: "Fitspin Cancún", slug: "fitspin-cancun" }],
    listLocations: async () => [{ id: 200, name: "Cancún", slug: "cancun", brandSlug: "fitspin-cancun" }],
    listCombos: async () => combos,
    listMemberships: async () => extras?.memberships ?? [],
    listProducts: async () => extras?.products ?? [],
    getProfile: async () => null,
  } as unknown as GafaClient;
}

const helipuerto: Meeting = {
  id: 99,
  name: "HELIPUERTO BICI 🚲",
  startsAt: "2026-08-15T09:30:00",
  timezone: "America/Mexico_City",
  serviceName: "HELIPUERTO BICI 🚲",
};

function renderShop(
  client: GafaClient,
  meeting?: Meeting | null,
  seat?: { seatObjectId?: number; seatLabel?: string },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CheckoutModal
        client={client}
        brandSlug="fitspin-cancun"
        locationSlug="cancun"
        locationName="Polanco"
        meeting={meeting}
        seatObjectId={seat?.seatObjectId}
        seatLabel={seat?.seatLabel}
        skipCatalog={false}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe("CheckoutModal catalog loading", () => {
  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
    localStorage.removeItem("gafa-sdk:cart-v1");
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

  it("quita la clase del carrito sin vaciar el paquete y no la restaura", async () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    const view = renderShop(mockClient(Promise.resolve([])), helipuerto);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /quitar clase/i }).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/HELIPUERTO BICI/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /compra para reservar/i })).toBeTruthy();
    expect(useCartStore.getState().reservation?.meetingId).toBe(99);

    fireEvent.click(screen.getAllByRole("button", { name: /quitar clase/i })[0]!);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /quitar clase/i })).toBeNull();
    });
    expect(screen.queryByText(/HELIPUERTO BICI/i)).toBeNull();
    expect(screen.getByRole("heading", { name: /elige tu plan/i })).toBeTruthy();
    expect(screen.getAllByText("5 Clases Cancún").length).toBeGreaterThan(0);
    expect(useCartStore.getState().reservation).toBeNull();
    expect(useCartStore.getState().lines).toEqual([cartLine]);

    const client = mockClient(Promise.resolve([]));
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <CheckoutModal
          client={client}
          brandSlug="fitspin-cancun"
          locationSlug="cancun"
          locationName="Polanco"
          meeting={{ ...helipuerto }}
          skipCatalog={false}
          onClose={() => undefined}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(useCartStore.getState().reservation).toBeNull();
      expect(screen.queryByRole("button", { name: /quitar clase/i })).toBeNull();
    });
    expect(screen.getAllByText("5 Clases Cancún").length).toBeGreaterThan(0);
  });

  it("ancla el lugar elegido en el chip de la clase", async () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    renderShop(mockClient(Promise.resolve([])), helipuerto, { seatObjectId: 35042, seatLabel: "42" });

    await waitFor(() => {
      expect(screen.getByText(/Lugar 42/)).toBeTruthy();
    });
    expect(useCartStore.getState().reservation).toEqual(
      expect.objectContaining({ meetingId: 99, seatObjectId: 35042, seatLabel: "42" }),
    );
  });

  it("sin lugar no inventa posición en la reserva anclada", async () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    renderShop(mockClient(Promise.resolve([])), helipuerto);

    await waitFor(() => {
      expect(useCartStore.getState().reservation?.meetingId).toBe(99);
    });
    expect(useCartStore.getState().reservation?.seatObjectId).toBeUndefined();
    expect(useCartStore.getState().reservation?.seatLabel).toBeUndefined();
    expect(screen.queryByText(/Lugar /)).toBeNull();
  });

  it("el carrito arranca colapsado y el toggle lo abre", async () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    renderShop(mockClient(Promise.resolve([])));

    const aside = document.querySelector(".gafa-checkout__cart");
    expect(aside?.getAttribute("data-open")).not.toBe("true");

    const toggle = screen.getByRole("button", { name: /ver productos del carrito/i });
    fireEvent.click(toggle);
    expect(aside?.getAttribute("data-open")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /ocultar productos del carrito/i }));
    expect(aside?.getAttribute("data-open")).not.toBe("true");
  });

  it("muestra la pestaña de Productos junto a Paquetes y Membresías", async () => {
    renderShop(
      mockClient(Promise.resolve([]), {
        products: [{ id: 9, name: "Agua", type: "product", price: 40, priceFinal: 40, priceLabel: "$40" }],
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /productos/i })).toBeTruthy();
    });
    expect(screen.getByRole("tab", { name: /paquetes/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /membresías/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /productos/i }));
    await waitFor(() => {
      expect(screen.getByText("Agua")).toBeTruthy();
    });
    expect(screen.getByRole("tab", { name: /productos/i }).getAttribute("aria-selected")).toBe("true");
  });

  it("la pestaña de Productos existe aunque el catálogo de tienda venga vacío", async () => {
    renderShop(mockClient(Promise.resolve([])));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /productos/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("tab", { name: /productos/i }));
    await waitFor(() => {
      expect(screen.getByText(/no hay productos disponibles/i)).toBeTruthy();
    });
  });

  it("si listProducts viene vacío, usa productsSelection del fancy", async () => {
    const client = {
      ...mockClient(Promise.resolve([])),
      getProfile: async () => ({ id: 1, name: "Gabriel", email: "g@buq.mx" }),
      getCheckoutConfig: async () => ({
        brandSlug: "fitspin-cancun",
        locationSlug: "cancun",
        products: [{ id: 9, name: "Agua", type: "product", price: 40, priceFinal: 40, priceLabel: "$40" }],
        combos: [],
        memberships: [],
        paymentMethods: [],
      }),
    } as unknown as GafaClient;

    renderShop(client);

    fireEvent.click(await screen.findByRole("tab", { name: /productos/i }));
    await waitFor(() => {
      expect(screen.getByText("Agua")).toBeTruthy();
    });
  });
});
