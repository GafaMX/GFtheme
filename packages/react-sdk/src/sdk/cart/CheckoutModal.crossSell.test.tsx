import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem, CheckoutConfig, GafaClient, Meeting } from "../client/types";
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

const fiveClasses: CartLine = {
  key: "fitspin:combo:973",
  id: 973,
  type: "combo",
  name: "5 Clases",
  price: 0,
  priceLabel: "$0",
  amount: 1,
  brandSlug: "fitspin",
  locationSlug: "polanco",
};

const sculpt: CatalogItem = {
  id: 2878,
  name: "SCULPT",
  type: "combo",
  price: 275,
  priceFinal: 275,
  expirationDays: 30,
};

const water: CatalogItem = {
  id: 9,
  name: "Agua",
  type: "product",
  price: 0,
  priceFinal: 0,
};

const helipuerto: Meeting = {
  id: 849768,
  name: "HELIPUERTO BICI",
  startsAt: "2026-08-15T09:30:00",
  timezone: "America/Mexico_City",
  serviceName: "HELIPUERTO BICI",
};

const CROSS_SELL = {
  enabled: true,
  payTitle: "¿Quieres agregar algo más?",
  thanksTitle: "¿Algo más para después de tu clase?",
  itemType: "combo" as const,
  itemId: 2878,
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
    combos: [sculpt],
    memberships: [],
    products: [water],
    gafapayClientId: "282",
    gafapayClientSecret: "secret",
    companiesId: 80,
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
    listBrands: async () => [{ id: 86, name: "Fitspin", slug: "fitspin" }],
    listLocations: async () => [{ id: 122, name: "POLANCO", slug: "polanco", brandSlug: "fitspin" }],
    listCombos: async () => [sculpt, { id: 973, name: "5 Clases", type: "combo", price: 0, priceFinal: 0 }],
    listMemberships: async () => [],
    listProducts: async () => [water],
    getProfile: async () => ({
      id: 4412,
      name: "Ana Pérez",
      email: "ana@fitspin.mx",
      firstName: "Ana",
    }),
    getCheckoutConfig: async () => checkoutConfig(),
    reservatePurchase: vi.fn(async () => ({ purchaseId: 88, reservationId: 3509997 })),
    initialPurchase: vi.fn(async () => ({ purchaseId: 88, checkoutToken: "chk_1" })),
    pollInitialPurchaseStatus: vi.fn(async () => ({ code: 1, reservationId: 3509997 })),
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

function renderPay(client: GafaClient, extras: { meeting?: Meeting | null; crossSell?: unknown } = {}) {
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
        meeting={extras.meeting}
        crossSell={extras.crossSell ?? CROSS_SELL}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("CheckoutModal cross-sell", () => {
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
    localStorage.removeItem("gafa-sdk:cart-v1");
    vi.clearAllMocks();
  });

  it("pinta el título libre y agrega el ítem al carrito sin salir de pagar", async () => {
    useCartStore.setState({ lines: [fiveClasses], reservation: null });
    renderPay(mockClient());

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /¿quieres agregar algo más\?/i })).toBeTruthy();
    });
    expect(screen.getByText("SCULPT")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^agregar$/i }));
    await waitFor(() => {
      expect(useCartStore.getState().lines.some((line) => line.id === 2878)).toBe(true);
    });
    expect(screen.queryByRole("heading", { name: /¿quieres agregar algo más\?/i })).toBeNull();
  });

  it("en thank you usa el otro título y la siguiente compra manda reservations_id", async () => {
    useCartStore.setState({ lines: [fiveClasses], reservation: null });
    const client = mockClient({
      listCombos: async () => [water as CatalogItem, { id: 973, name: "5 Clases", type: "combo", price: 0, priceFinal: 0 }],
    });
    renderPay(client, {
      meeting: helipuerto,
      crossSell: {
        enabled: true,
        payTitle: "¿Agua para la bici?",
        thanksTitle: "¿Algo más para después de tu clase?",
        itemType: "product",
        itemId: 9,
      },
    });

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /confirmar pedido/i }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));

    await waitFor(() => {
      expect(screen.getByText(/reserva confirmada/i)).toBeTruthy();
    });
    expect(screen.getByRole("heading", { name: /¿algo más para después de tu clase\?/i })).toBeTruthy();
    expect(screen.getByText(/se suma a tu reserva #3509997/i)).toBeTruthy();

    const first = vi.mocked(client.reservatePurchase!).mock.calls[0][0];
    expect(first.meetingId).toBe(849768);
    expect(first.reservationId).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: /^agregar$/i }));

    await waitFor(() => {
      const confirm = screen.getByRole("button", { name: /confirmar pedido/i }) as HTMLButtonElement;
      expect(confirm.disabled).toBe(false);
    });
    expect(screen.getByText(/se suma a tu reserva #3509997/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /confirmar pedido/i }));

    await waitFor(() => {
      expect(vi.mocked(client.reservatePurchase!).mock.calls.length).toBe(2);
    });
    const followUp = vi.mocked(client.reservatePurchase!).mock.calls[1][0];
    expect(followUp.reservationId).toBe(3509997);
    expect(followUp.meetingId).toBeUndefined();
    expect(followUp.lines.some((line) => line.id === 9 && line.type === "product")).toBe(true);
  });
});
