import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GafaClient } from "../client/types";
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

/** Sin sesión: el checkout se planta en el paso de cuenta. */
function mockClient(): GafaClient {
  return {
    listBrands: async () => [{ id: 1, name: "Fitspin Cancún", slug: "fitspin-cancun" }],
    listLocations: async () => [{ id: 200, name: "Cancún", slug: "cancun", brandSlug: "fitspin-cancun" }],
    listCombos: async () => [],
    listMemberships: async () => [],
    listRegistrationFields: async () => [],
    getProfile: async () => null,
  } as unknown as GafaClient;
}

function renderAuthStep() {
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

describe("CheckoutModal auth step", () => {
  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
    localStorage.removeItem("gafa-sdk:cart-v1");
  });

  it("pinta un solo título (el del hero), sin el encabezado del AuthWidget", async () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    renderAuthStep();

    expect(await screen.findByRole("heading", { name: "Inicia sesión para pagar" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Inicia sesión" })).toBeNull();
    expect(screen.queryByText("Cuenta")).toBeNull();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(document.body.querySelector(":scope > .gafa-checkout-overlay")).toBeTruthy();
  });

  it("el título del hero sigue al formulario visible (crear cuenta / recuperar contraseña)", async () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    renderAuthStep();

    fireEvent.click(await screen.findByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Crea tu cuenta para pagar" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "Crea tu cuenta" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    fireEvent.click(await screen.findByRole("button", { name: /olvidaste tu contraseña/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "Recupera tu contraseña" })).toHaveLength(1);
    });
    expect(screen.queryByRole("heading", { name: "Inicia sesión para pagar" })).toBeNull();
  });
});
