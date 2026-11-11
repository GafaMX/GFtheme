import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem, GafaClient } from "../client/types";
import type { GafaPayIsland, GafaPayWidgetProps } from "../payments/gafaPay";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";
import { reservateRetryWait } from "./reservateRetry";
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

const ENROLLMENT = {
  comboId: 3491,
  label: "Matrícula",
  membershipIds: [1272, 1271, 1204],
  firstTimeScope: "any_membership" as const,
  mode: "first_purchase" as const,
};

const silver: CatalogItem = {
  id: 1271,
  name: "Silver",
  type: "membership",
  price: 85,
  priceFinal: 85,
  expirationDays: 30,
  subscribable: true,
  raw: { id: 1271, expiration_days: 30 },
};

const matricula: CatalogItem = {
  id: 3491,
  name: "Matrícula",
  type: "combo",
  price: 30,
  priceFinal: 30,
  raw: { id: 3491 },
};

const silverLine: CartLine = {
  key: "the-base:membership:1271",
  id: 1271,
  type: "membership",
  name: "Silver",
  price: 85,
  priceLabel: "85€",
  amount: 1,
  brandSlug: "the-base",
  locationSlug: "pozuelo",
  raw: { expiration_days: 30 },
};

function mockClient(overrides: Partial<GafaClient> = {}): GafaClient {
  return {
    listBrands: async () => [
      { id: 225, name: "The Base", slug: "the-base", currency: { prefix: "€", suffix: "EUR", code: "EUR" } },
    ],
    listLocations: async () => [{ id: 332, name: "Pozuelo", slug: "pozuelo", brandSlug: "the-base" }],
    listCombos: async () => [matricula],
    listMemberships: async () => [silver],
    listProducts: async () => [],
    getProfile: async () => ({
      id: 4412,
      name: "Gabriel",
      email: "gabriel@buq.mx",
      firstName: "Gabriel",
      lastName: "Arrechea",
    }),
    getCheckoutConfig: async () => ({
      brandSlug: "the-base",
      locationSlug: "pozuelo",
      currency: { prefix: "€", suffix: "EUR", code: "EUR" },
      paymentMethods: [{ id: 3, name: "Stripe", slug: "stripe" }],
      giftCardsEnabled: false,
      discountCodesEnabled: false,
      canRedeemStoreCredit: false,
      combos: [matricula],
      memberships: [silver],
      products: [],
      gafapayClientId: "1",
      gafapayClientSecret: "x",
      companiesId: 204,
      locationId: 332,
      userProfileId: 4412,
      urls: {
        reservation: "https://example.test/reservate",
        initialPurchase: "https://example.test/purchase",
        initialPurchaseStatus: "https://example.test/status",
      },
    }),
    previewPurchase: vi.fn(async () => undefined),
    reservatePurchase: vi.fn(async () => ({ purchaseId: 88 })),
    listUserMemberships: vi.fn(async () => []),
    listUserPurchases: vi.fn(async () => []),
    login: async () => ({ access_token: "t" }),
    logout: () => undefined,
    ...overrides,
  } as GafaClient;
}

function renderHold(client: GafaClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutModal
        client={client}
        brandSlug="the-base"
        locationSlug="pozuelo"
        skipCatalog
        membershipEnrollment={ENROLLMENT}
        chargeEnrollmentFee={async () => ({ message: { mock: true, kind: "enrollment" } })}
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("CheckoutModal matrícula + preflight Stripe", () => {
  let lastProps: GafaPayWidgetProps | undefined;

  beforeEach(() => {
    lastProps = undefined;
    useCartStore.setState({ lines: [silverLine], reservation: null });
    reservateRetryWait.wait = async () => undefined;
    mocks.loadGafaPay.mockResolvedValue({
      React: { createElement: () => null },
      ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true },
      elements: { StripePayment: function StripePayment() {} },
    });
    mocks.mountGafaPayWidget.mockImplementation(
      (_runtime, container, _slug, props: GafaPayWidgetProps): GafaPayIsland => {
        lastProps = props;
        if (container instanceof Element) {
          container.innerHTML = `
            <input id="saveCard" type="checkbox" checked />
            <input id="recurringPayment" type="checkbox" checked />
          `;
        }
        return {
          update: (next) => {
            lastProps = next;
          },
          unmount: () => undefined,
        };
      },
    );
    mocks.waitForWidgetContent.mockResolvedValue(undefined);
    mocks.ensureLegacyPaypalCheckout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    clearToasts();
    resetToastHostForTests();
    useCartStore.setState({ lines: [], reservation: null });
    delete window._handleStripePayment;
    reservateRetryWait.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    vi.clearAllMocks();
  });

  it("historial tardío: Stripe monta ya, luego el carrito se estabiliza a 115€", async () => {
    let releaseHistory: (value: unknown[]) => void = () => undefined;
    const history = new Promise<unknown[]>((resolve) => {
      releaseHistory = resolve;
    });
    const previewPurchase = vi.fn(async () => undefined);
    const client = mockClient({
      listUserMemberships: vi.fn(() => history as Promise<never[]>),
      listUserPurchases: vi.fn(() => history as Promise<never[]>),
      previewPurchase,
    });
    renderHold(client);

    await waitFor(() => expect(mocks.mountGafaPayWidget).toHaveBeenCalled());
    expect(screen.queryByText(/revisando tu compra/i)).toBeNull();
    expect(previewPurchase).not.toHaveBeenCalled();
    expect(screen.queryByText(/un botón, dos cargos/i)).toBeNull();

    releaseHistory([]);

    await waitFor(() => expect(screen.getByText(/matrícula · solo primer pago/i)).toBeTruthy());
    await waitFor(() => {
      expect((screen.getByRole("button", { name: /pagar 115/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(lastProps).toBeTruthy();
    expect(previewPurchase).toHaveBeenCalledTimes(1);
  });

  it("si la revisión se cuelga, Stripe monta igual y no hay skeleton", async () => {
    const previewPurchase = vi.fn(() => new Promise<void>(() => undefined));
    const client = mockClient({ previewPurchase });
    renderHold(client);

    await waitFor(() => expect(mocks.mountGafaPayWidget).toHaveBeenCalled());
    await waitFor(() => {
      expect((screen.getByRole("button", { name: /pagar 115/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.queryByText(/revisando tu compra/i)).toBeNull();
    expect(screen.queryByText(/un botón, dos cargos/i)).toBeNull();
  });

  it("un 422 de la revisión muestra el error y no cobra", async () => {
    const stripe = vi.fn();
    window._handleStripePayment = stripe;
    const client = mockClient({
      previewPurchase: vi.fn(async () => {
        throw Object.assign(
          new Error("Lo sentimos, no puedes adquirir esta membresía porque ya cuentas con una igual activa."),
          { status: 422 },
        );
      }),
    });
    renderHold(client);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent ?? "").toMatch(/ya cuentas con una igual activa/i);
    });
    expect(screen.getByRole("heading", { name: /lo sentimos/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pagar/i })).toBeNull();
    expect(stripe).not.toHaveBeenCalled();
    expect(client.reservatePurchase).not.toHaveBeenCalled();
  });

  it("carrito de dos líneas cobra membresía y matrícula por separado", async () => {
    const client = mockClient();
    renderHold(client);

    await waitFor(() => expect(screen.getByText(/matrícula · solo primer pago/i)).toBeTruthy());
    await waitFor(() => {
      expect((screen.getByRole("button", { name: /pagar 115/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.getByText("fijo")).toBeTruthy();
    expect(mocks.mountGafaPayWidget).toHaveBeenCalled();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({
        message: { stripeToken: "tok_visa" },
        subscriptionId: "sub_membership",
        recurringPayment: true,
      });
    };
    fireEvent.click(screen.getByRole("button", { name: /pagar 115/i }));

    await waitFor(() => expect(client.reservatePurchase).toHaveBeenCalledTimes(2));
    const [membership, enrollment] = vi.mocked(client.reservatePurchase!).mock.calls.map((call) => call[0]);
    expect(membership.lines.map((line) => line.id)).toEqual([1271]);
    expect(membership.subscribe).toBe(true);
    expect(enrollment.lines.map((line) => line.id)).toEqual([3491]);
    expect(enrollment.subscribe).toBe(false);
    expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
  });
});
