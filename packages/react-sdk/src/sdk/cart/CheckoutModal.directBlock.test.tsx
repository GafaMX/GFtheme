import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem, CheckoutConfig, GafaClient } from "../client/types";
import type { GafaPayIsland, GafaPayWidgetProps } from "../payments/gafaPay";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore } from "./cartStore";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    loadGafaPay: vi.fn(),
    mountGafaPayWidget: vi.fn(),
    waitForWidgetContent: vi.fn(),
    ensureLegacyPaypalCheckout: vi.fn(),
  },
}));

vi.mock("../payments/gafaPay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../payments/gafaPay")>();
  return {
    ...actual,
    loadGafaPay: mocks.loadGafaPay,
    mountGafaPayWidget: mocks.mountGafaPayWidget,
    waitForWidgetContent: mocks.waitForWidgetContent,
    ensureLegacyPaypalCheckout: mocks.ensureLegacyPaypalCheckout,
  };
});

const otherCombo: CatalogItem = {
  id: 12,
  name: "Otro paquete",
  price: 100,
  type: "combo",
};

const sculpt: CatalogItem = {
  id: 971,
  name: "SCULPT",
  price: 275,
  type: "combo",
};

const unlimited: CatalogItem = {
  id: 50,
  name: "Ilimitada",
  price: 999,
  type: "membership",
};

function checkoutConfig(): CheckoutConfig {
  return {
    brandSlug: "fitspin",
    locationSlug: "polanco",
    currency: { prefix: "$", suffix: "MXN", code: "MXN" },
    paymentMethods: [{ id: 3, name: "Stripe", slug: "stripe" }],
    giftCardsEnabled: false,
    discountCodesEnabled: false,
    canRedeemStoreCredit: false,
    combos: [],
    memberships: [],
    products: [],
    gafapayClientId: "282",
    gafapayClientSecret: "secret",
    companiesId: 1,
    locationId: 122,
    userProfileId: 4412,
    usersId: 99,
    urls: {
      reservation: "https://buq.partners/api/reservate",
      initialPurchase: "https://buq.partners/api/purchase",
      initialPurchaseStatus: "https://buq.partners/api/status",
    },
  };
}

function mockClient(overrides: Partial<GafaClient> = {}): GafaClient {
  return {
    listBrands: async () => [{ id: 1, name: "Fitspin", slug: "fitspin" }],
    listLocations: async () => [{ id: 122, name: "POLANCO", slug: "polanco", brandSlug: "fitspin" }],
    listCombos: async () => [otherCombo],
    listMemberships: async () => [],
    listProducts: async () => [],
    getProfile: async () => ({
      id: 4412,
      name: "Ana Pérez",
      email: "ana@fitspin.mx",
      firstName: "Ana",
      lastName: "Pérez",
    }),
    getCheckoutConfig: async () => checkoutConfig(),
    previewPurchase: vi.fn(async () => undefined),
    reservatePurchase: vi.fn(async () => ({ purchaseId: 88 })),
    login: async () => ({ access_token: "t" }),
    logout: () => undefined,
    register: async () => ({}),
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
    openCheckout: async () => undefined,
    openReservationCheckout: async () => undefined,
    listServices: async () => [],
    listStaff: async () => [],
    listMeetings: async () => [],
    listRegistrationFields: async () => [],
    listUserCredits: async () => [],
    listUserMemberships: async () => [],
    listUserReservations: async () => [],
    listUserPurchases: async () => [],
    cancelReservation: async () => undefined,
    ...overrides,
  } as GafaClient;
}

function renderDirect(
  client: GafaClient,
  preselect: { type: "combo" | "membership"; id: number },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutModal
        client={client}
        brandSlug="fitspin"
        locationSlug="polanco"
        preselect={preselect}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("CheckoutModal bloqueo al clic", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [], reservation: null });
    mocks.loadGafaPay.mockResolvedValue({
      React: { createElement: () => null },
      ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true },
      elements: { StripePayment: function StripePayment() {} },
    });
    mocks.mountGafaPayWidget.mockImplementation(
      (_runtime, _container, _slug, _props: GafaPayWidgetProps): GafaPayIsland => ({
        update: () => undefined,
        unmount: () => undefined,
      }),
    );
    mocks.waitForWidgetContent.mockResolvedValue(undefined);
    mocks.ensureLegacyPaypalCheckout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
    vi.clearAllMocks();
  });

  it("un paquete fuera del catálogo de la sesión muestra el límite y no el resto de paquetes", async () => {
    const client = mockClient({
      previewPurchase: vi.fn(async () => {
        throw new Error("Este producto no puede ser comprado porque ha llegado a su límite.");
      }),
    });
    renderDirect(client, { type: "combo", id: 971 });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent ?? "").toMatch(/ha llegado a su límite/i);
    });
    expect(screen.getByRole("heading", { name: /lo sentimos/i })).toBeTruthy();
    expect(screen.queryByText("Otro paquete")).toBeNull();
    expect(screen.queryByRole("button", { name: /pagar/i })).toBeNull();
    expect(screen.queryByText(/elige tu plan/i)).toBeNull();
    expect(client.previewPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [expect.objectContaining({ id: 971, type: "combo", amount: 1 })],
      }),
    );
    expect(client.reservatePurchase).not.toHaveBeenCalled();
    expect(mocks.loadGafaPay).not.toHaveBeenCalled();
  });

  it("una membresía que ya tiene no abre el formulario de pago", async () => {
    const client = mockClient({
      listCombos: async () => [],
      listMemberships: async () => [unlimited],
      previewPurchase: vi.fn(async () => {
        throw new Error(
          "Lo sentimos, no puedes adquirir esta membresía porque ya cuentas con una igual activa.",
        );
      }),
    });
    renderDirect(client, { type: "membership", id: 50 });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent ?? "").toMatch(/ya cuentas con una igual activa/i);
    });
    expect(screen.queryByRole("button", { name: /pagar/i })).toBeNull();
    expect(screen.queryByText(/revisa tu pedido y paga/i)).toBeNull();
    expect(mocks.loadGafaPay).not.toHaveBeenCalled();
    expect(client.reservatePurchase).not.toHaveBeenCalled();
  });

  it("si Buq deja pasar el paquete, el clic sí llega al pago", async () => {
    const client = mockClient({
      listCombos: async () => [sculpt],
      previewPurchase: vi.fn(async () => undefined),
    });
    renderDirect(client, { type: "combo", id: 971 });

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.getByText("SCULPT")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /lo sentimos/i })).toBeNull();
    expect(client.previewPurchase).toHaveBeenCalled();
  });

  it("si el producto no existe, avisa y no abre el catálogo", async () => {
    const client = mockClient({
      previewPurchase: vi.fn(async () => undefined),
    });
    renderDirect(client, { type: "combo", id: 404 });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent ?? "").toMatch(/ya no está disponible/i);
    });
    expect(screen.queryByText("Otro paquete")).toBeNull();
    expect(screen.queryByRole("button", { name: /pagar/i })).toBeNull();
  });
});
