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
  name: "SCULPT",
  price: 275,
  priceLabel: "$275",
  amount: 1,
  brandSlug: "fitspin",
  locationSlug: "polanco",
  expirationLabel: "Expira en 30 días",
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
      initialPurchase: "https://buq.partners/api/purchase",
      initialPurchaseStatus: "https://buq.partners/api/status",
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
      lastName: "Pérez",
      phone: "5550000000",
    }),
    getCheckoutConfig: async () => checkoutConfig(),
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

describe("CheckoutModal Stripe / GafaPay confirm", () => {
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

  it("monta GafaPayFront con onStartPayAction (GafaPay lo llama sin optional chaining)", async () => {
    renderPay(mockClient());
    await waitUntilPayReady();

    expect(typeof lastProps?.onStartPayAction).toBe("function");
    expect(() => lastProps?.onStartPayAction()).not.toThrow();
  });

  it("no se queda en Procesando si el handler de Stripe revienta", async () => {
    window._handleStripePayment = async () => {
      const onStartPayAction = undefined as unknown as () => void;
      onStartPayAction();
    };

    renderPay(mockClient());
    await waitUntilPayReady();

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/procesador de pago aún no está listo/i)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /procesando/i })).toBeNull();
    expect(payButton().disabled).toBe(false);
  });

  it("tras el token de GafaPay llama initial-purchase y muestra el thank you", async () => {
    const client = mockClient();
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(client.initialPurchase).toHaveBeenCalled();
    expect(screen.getByText(/orden #88/i)).toBeTruthy();
  });

  it("si falta initialPurchase no se queda en Procesando: muestra el error", async () => {
    const { initialPurchase: _ignored, ...rest } = mockClient();
    renderPay(rest as GafaClient);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/no pudimos completar la compra/i)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /procesando/i })).toBeNull();
  });

  it("no bloquea el thank you con el poll, pero lo sigue esperando en segundo plano", async () => {
    const client = mockClient({
      pollInitialPurchaseStatus: vi.fn(() => new Promise(() => undefined)),
    });
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(client.pollInitialPurchaseStatus).toHaveBeenCalled();
  });

  it("reintenta el status hasta que gafa.fit resuelve el checkout", async () => {
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ code: 0 })
      .mockResolvedValue({ code: 1, reservationId: 77 });
    useCartStore.setState({
      lines: [cartLine],
      reservation: {
        meetingId: 501,
        meetingName: "HELIPUERTO BICI",
        serviceName: "HELIPUERTO BICI",
        startsAt: "2026-08-18T09:30:00",
        timezone: "America/Mexico_City",
        brandSlug: "fitspin",
        locationSlug: "polanco",
      },
    });
    renderPay(mockClient({ pollInitialPurchaseStatus: poll }));
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/reserva confirmada/i)).toBeTruthy();
    });
    await waitFor(
      () => {
        expect(screen.getByText(/reserva #77/i)).toBeTruthy();
      },
      { timeout: 5000 },
    );
    expect(poll.mock.calls.length).toBeGreaterThan(1);
  });

  it("si gafa.fit no resuelve el checkout, lo dice en vez de darlo por bueno", async () => {
    const client = mockClient({
      pollInitialPurchaseStatus: vi.fn(async () => ({ code: -1, message: "Checkout no resuelto" })),
    });
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/seguimos confirmando la compra/i)).toBeTruthy();
    });
  });

});
