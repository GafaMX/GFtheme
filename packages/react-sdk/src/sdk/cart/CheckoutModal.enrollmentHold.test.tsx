import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem, GafaClient } from "../client/types";
import type { GafaPayIsland, GafaPayWidgetProps } from "../payments/gafaPay";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";
import { setPreviewPurchaseTimeoutMsForTests } from "./purchasePreview";
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
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("CheckoutModal matrícula + preflight Stripe", () => {
  let lastProps: GafaPayWidgetProps | undefined;

  beforeEach(() => {
    lastProps = undefined;
    setPreviewPurchaseTimeoutMsForTests(40);
    useCartStore.setState({ lines: [silverLine], reservation: null });
    reservateRetryWait.wait = async () => undefined;
    mocks.loadGafaPay.mockResolvedValue({
      React: { createElement: () => null },
      ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true },
      elements: { StripePayment: function StripePayment() {} },
    });
    mocks.mountGafaPayWidget.mockImplementation(
      (_runtime, _container, _slug, props: GafaPayWidgetProps): GafaPayIsland => {
        lastProps = props;
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
    setPreviewPurchaseTimeoutMsForTests(null);
    delete window._handleStripePayment;
    reservateRetryWait.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    vi.clearAllMocks();
  });

  it("historial tardío: una sola revisión y carrito estable a 115€", async () => {
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

    await waitFor(() => expect(screen.getByText(/revisando tu compra/i)).toBeTruthy());
    expect(previewPurchase).not.toHaveBeenCalled();
    expect(screen.queryByText(/un botón, dos cargos/i)).toBeNull();

    releaseHistory([]);

    await waitFor(() => expect(screen.getByText(/matrícula · solo primer pago/i)).toBeTruthy());
    await waitFor(() => {
      expect((screen.getByRole("button", { name: /pagar 115/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(mocks.mountGafaPayWidget).toHaveBeenCalled();
    expect(lastProps).toBeTruthy();
    expect(screen.queryByText(/revisando tu compra/i)).toBeNull();
    expect(previewPurchase).toHaveBeenCalledTimes(1);
  });

  it("si la revisión se cuelga, suelta el skeleton y monta Stripe", async () => {
    const previewPurchase = vi.fn(() => new Promise<void>(() => undefined));
    const client = mockClient({ previewPurchase });
    renderHold(client);

    await waitFor(() => expect(screen.getByText(/revisando tu compra/i)).toBeTruthy());
    await waitFor(() => {
      expect(screen.queryByText(/revisando tu compra/i)).toBeNull();
      expect((screen.getByRole("button", { name: /pagar 115/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(mocks.mountGafaPayWidget).toHaveBeenCalled();
    expect(screen.queryByText(/un botón, dos cargos/i)).toBeNull();
  });

  it("carrito de dos líneas (membresía + matrícula) monta Stripe", async () => {
    const client = mockClient();
    renderHold(client);

    await waitFor(() => expect(screen.getByText(/matrícula · solo primer pago/i)).toBeTruthy());
    await waitFor(() => {
      expect((screen.getByRole("button", { name: /pagar 115/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(screen.getByText("fijo")).toBeTruthy();
    expect(screen.queryByText(/un botón, dos cargos/i)).toBeNull();
    expect(mocks.loadGafaPay).toHaveBeenCalled();
    expect(mocks.mountGafaPayWidget).toHaveBeenCalled();
    expect(vi.mocked(client.previewPurchase!).mock.calls.length).toBeGreaterThanOrEqual(1);
    const payload = vi.mocked(client.previewPurchase!).mock.calls[0]?.[0];
    expect(payload?.lines.some((line) => line.id === 1271)).toBe(true);
  });
});
