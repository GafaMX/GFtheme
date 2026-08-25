import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutConfig, GafaClient } from "../client/types";
import type { GafaPayIsland, GafaPayWidgetProps } from "../payments/gafaPay";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";

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

const cartLine: CartLine = {
  key: "fitspin:combo:971",
  id: 971,
  type: "combo",
  name: "5 CLASES",
  price: 1275,
  priceLabel: "$1,275",
  amount: 1,
  brandSlug: "fitspin",
  locationSlug: "polanco",
};

function checkoutConfig(): CheckoutConfig {
  return {
    brandSlug: "fitspin",
    locationSlug: "polanco",
    currency: { prefix: "$", suffix: "MXN", code: "MXN" },
    paymentMethods: [{ id: 3, name: "Stripe", slug: "stripe" }],
    giftCardsEnabled: true,
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
      checkGiftCode:
        "https://buq.partners/api/brand/fitspin/location/polanco/reservation/check-gift-code/_|_",
      generateGiftCode:
        "https://buq.partners/api/brand/fitspin/location/polanco/reservation/generate-code",
    },
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
    }),
    getCheckoutConfig: async () => checkoutConfig(),
    checkGiftCode: vi.fn(async ({ code }) => {
      const compact = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (compact.includes("TAKEN")) {
        return {
          valid: true,
          code: compact,
          httpStatus: 200,
          raw: { id: 9, code: compact, balance: 100, name: "Ocupada" },
        };
      }
      return { valid: false, code: compact, httpStatus: 404, message: "Gift card not found" };
    }),
    generateGiftCode: vi.fn(async () => "90AE0C89F5D1466A7C91E2F988"),
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

function renderPay(client: GafaClient) {
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

describe("CheckoutModal Convertir en GiftCard", () => {
  let lastProps: GafaPayWidgetProps | undefined;

  beforeEach(() => {
    lastProps = undefined;
    useCartStore.setState({ lines: [cartLine], reservation: null });
    mocks.loadGafaPay.mockResolvedValue({
      React: { createElement: () => null },
      ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true },
      elements: { StripePayment: function StripePayment() {} },
    });
    mocks.mountGafaPayWidget.mockImplementation((_runtime, _container, _slug, props: GafaPayWidgetProps): GafaPayIsland => {
      lastProps = props;
      return {
        update: (next) => {
          lastProps = next;
        },
        unmount: () => undefined,
      };
    });
    mocks.waitForWidgetContent.mockResolvedValue(undefined);
    mocks.ensureLegacyPaypalCheckout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
    delete window._handleStripePayment;
    vi.clearAllMocks();
  });

  function payButton() {
    return screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement;
  }

  async function waitUntilPayReady() {
    await waitFor(() => {
      expect(payButton().disabled).toBe(false);
    });
  }

  it("es Convertir en GiftCard, no canje en checkout ni en mostrador", async () => {
    renderPay(mockClient());
    await waitUntilPayReady();

    expect(screen.getByRole("checkbox", { name: /convertir en giftcard/i })).toBeTruthy();
    expect(screen.queryByText(/canjear gift card/i)).toBeNull();
    expect(screen.queryByText(/mostrador/i)).toBeNull();
    expect(screen.getByText(/para regalar/i)).toBeTruthy();
  });

  it("al activarlo genera un código corto y lo marca válido", async () => {
    const client = mockClient();
    renderPay(client);
    await waitUntilPayReady();

    fireEvent.click(screen.getByRole("checkbox", { name: /convertir en giftcard/i }));

    const input = await screen.findByLabelText("Código de GiftCard");
    await waitFor(() => {
      expect(screen.getByText(/código válido/i)).toBeTruthy();
    });

    expect((input as HTMLInputElement).value).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect((input as HTMLInputElement).value).not.toMatch(/90AE0C89/);
    expect(client.generateGiftCode).toHaveBeenCalled();
    expect(client.checkGiftCode).toHaveBeenCalled();
  });

  it("valida al momento un código escrito y rechaza uno ocupado", async () => {
    renderPay(mockClient());
    await waitUntilPayReady();

    fireEvent.click(screen.getByRole("checkbox", { name: /convertir en giftcard/i }));
    await waitFor(() => {
      expect(screen.getByText(/código válido/i)).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Código de GiftCard"), {
      target: { value: "TAKEN99" },
    });

    await waitFor(() => {
      expect(screen.getByText(/ya está en uso/i)).toBeTruthy();
    });
    expect(payButton().disabled).toBe(true);
  });

  it("al pagar manda giftCode compacto; sin convertir no lo manda", async () => {
    const client = mockClient({
      generateGiftCode: vi.fn(async () => "K7M2P9QX"),
    });
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());
    await waitFor(() => {
      expect(client.reservatePurchase).toHaveBeenCalled();
    });
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0].giftCode).toBeNull();

    cleanup();
    useCartStore.setState({ lines: [cartLine], reservation: null });
    const client2 = mockClient({
      generateGiftCode: vi.fn(async () => "K7M2P9QX"),
    });
    lastProps = undefined;
    mocks.mountGafaPayWidget.mockImplementation((_runtime, _container, _slug, props: GafaPayWidgetProps): GafaPayIsland => {
      lastProps = props;
      return {
        update: (next) => {
          lastProps = next;
        },
        unmount: () => undefined,
      };
    });
    renderPay(client2);
    await waitUntilPayReady();

    fireEvent.click(screen.getByRole("checkbox", { name: /convertir en giftcard/i }));
    await waitFor(() => {
      expect(screen.getByText(/código válido/i)).toBeTruthy();
    });

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };
    fireEvent.click(payButton());

    await waitFor(() => {
      expect(client2.reservatePurchase).toHaveBeenCalled();
    });
    expect(vi.mocked(client2.reservatePurchase!).mock.calls[0][0].giftCode).toBe("K7M2P9QX");
  });
});
