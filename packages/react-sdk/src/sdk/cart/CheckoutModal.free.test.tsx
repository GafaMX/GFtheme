import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutConfig, GafaClient } from "../client/types";
import type { GafaPayIsland, GafaPayWidgetProps } from "../payments/gafaPay";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";
import { clearToasts } from "../toast/toastStore";
import { resetToastHostForTests } from "../toast/ToastHost";

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

const paidLine: CartLine = {
  key: "fitspin:combo:971",
  id: 971,
  type: "combo",
  name: "SCULPT",
  price: 275,
  priceLabel: "$275",
  amount: 1,
  brandSlug: "fitspin",
  locationSlug: "polanco",
};

const freeLine: CartLine = { ...paidLine, price: 0, priceLabel: "$0" };

function checkoutConfig(overrides: Partial<CheckoutConfig> = {}): CheckoutConfig {
  return {
    brandSlug: "fitspin",
    locationSlug: "polanco",
    currency: { prefix: "$", suffix: "MXN", code: "MXN" },
    paymentMethods: [{ id: 3, name: "Stripe", slug: "stripe" }],
    giftCardsEnabled: false,
    discountCodesEnabled: true,
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
      checkDiscountCode:
        "https://buq.partners/api/brand/fitspin/location/polanco/reservation/check-discount-code/_|_/4412",
    },
    ...overrides,
  };
}

function mockClient(overrides: Partial<GafaClient> = {}): GafaClient {
  return {
    listBrands: async () => [{ id: 1, name: "Fitspin", slug: "fitspin" }],
    listLocations: async () => [{ id: 122, name: "POLANCO", slug: "polanco", brandSlug: "fitspin" }],
    listCombos: async () => [],
    listMemberships: async () => [],
    getProfile: async () => ({
      id: 4412,
      name: "Ana Pérez",
      email: "ana@fitspin.mx",
      firstName: "Ana",
      lastName: "Pérez",
      phone: "5550000000",
    }),
    getCheckoutConfig: async () => checkoutConfig(),
    checkDiscountCode: vi.fn(async ({ code }) => ({
      valid: true,
      code,
      discountType: "percent",
      discountNumber: 100,
      label: "Pedido cubierto",
    })),
    reservatePurchase: vi.fn(async () => ({ purchaseId: 88 })),
    initialPurchase: vi.fn(async () => ({ purchaseId: 88, checkoutToken: "chk_1" })),
    pollInitialPurchaseStatus: vi.fn(async () => ({ code: 1, reservationId: 77 })),
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

function renderCheckout(client: GafaClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutModal
        client={client}
        brandSlug="fitspin"
        locationSlug="polanco"
        skipCatalog={true}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("CheckoutModal total $0 (sin tarjeta)", () => {
  beforeEach(() => {
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
    clearToasts();
    resetToastHostForTests();
    useCartStore.setState({ lines: [], reservation: null });
    vi.clearAllMocks();
  });

  it("con precio 0 no monta GafaPay y confirma sin payment_data", async () => {
    useCartStore.setState({ lines: [freeLine], reservation: null });
    const client = mockClient();
    renderCheckout(client);

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: /confirmar pedido/i }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
    expect(screen.getByText(/no hace falta tarjeta ni paypal/i)).toBeTruthy();
    expect(screen.queryByText(/pagar con tarjeta/i)).toBeNull();
    expect(mocks.loadGafaPay).not.toHaveBeenCalled();
    expect(mocks.mountGafaPayWidget).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));

    await waitFor(() => expect(client.reservatePurchase).toHaveBeenCalled());
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        paymentTypeId: 3,
        paymentData: undefined,
      }),
    );
    expect(client.initialPurchase).not.toHaveBeenCalled();
    expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    expect(screen.getByText(/pedido quedó registrado/i)).toBeTruthy();
    expect(screen.getByText(/\$0\s*MXN/)).toBeTruthy();
  });

  it("con descuento 100% quita la tarjeta y reserva sin payment_data", async () => {
    useCartStore.setState({ lines: [paidLine], reservation: null });
    const client = mockClient();
    renderCheckout(client);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(mocks.mountGafaPayWidget).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /¿tienes un código de descuento\?/i }));
    fireEvent.change(screen.getByPlaceholderText("Código"), { target: { value: "GRATIS" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: /confirmar pedido/i }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
    expect(screen.getByText(/no hace falta tarjeta ni paypal/i)).toBeTruthy();
    expect(screen.queryByText(/pagar con tarjeta/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /pagar \$/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));

    await waitFor(() => expect(client.reservatePurchase).toHaveBeenCalled());
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        paymentData: undefined,
        discountCode: "GRATIS",
      }),
    );
    expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    expect(screen.getByText(/pedido quedó registrado/i)).toBeTruthy();
    expect(screen.getByText(/\$0\s*MXN/)).toBeTruthy();
  });
});
