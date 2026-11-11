import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem, GafaClient } from "../client/types";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";
import { reservateRetryWait } from "./reservateRetry";
import { ENROLLMENT_CHARGE_FAILED_MESSAGE } from "./membershipEnrollment";
import { clearToasts } from "../toast/toastStore";
import { resetToastHostForTests } from "../toast/ToastHost";

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

const founder: CatalogItem = {
  id: 1203,
  name: "Socio Fundador",
  type: "membership",
  price: 85,
  priceFinal: 85,
  expirationDays: 30,
  raw: { id: 1203, expiration_days: 30 },
};

const bono: CatalogItem = {
  id: 88,
  name: "Bono 10 clases",
  type: "combo",
  price: 65,
  priceFinal: 65,
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
    listBrands: async () => [{ id: 225, name: "The Base", slug: "the-base", currency: { prefix: "€", suffix: "EUR", code: "EUR" } }],
    listLocations: async () => [{ id: 332, name: "Pozuelo", slug: "pozuelo", brandSlug: "the-base" }],
    listCombos: async () => [matricula, bono],
    listMemberships: async () => [silver, founder],
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
      discountCodesEnabled: true,
      canRedeemStoreCredit: false,
      combos: [matricula, bono],
      memberships: [silver, founder],
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
        checkDiscountCode: "https://example.test/check-discount",
      },
    }),
    previewPurchase: vi.fn(async () => undefined),
    reservatePurchase: vi.fn(async () => ({ purchaseId: 88 })),
    checkDiscountCode: vi.fn(async ({ code, lines }) => ({
      valid: true,
      code,
      discountType: "percent",
      discountNumber: 10,
      label: "Familia10",
      raw: { lines },
    })),
    listUserMemberships: vi.fn(async () => []),
    listUserPurchases: vi.fn(async () => []),
    login: async () => ({ access_token: "t" }),
    logout: () => undefined,
    ...overrides,
  } as GafaClient;
}

function renderEnrollment(client: GafaClient, extras: { skipCatalog?: boolean; failEnrollment?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutModal
        client={client}
        brandSlug="the-base"
        locationSlug="pozuelo"
        skipCatalog={extras.skipCatalog ?? true}
        membershipEnrollment={ENROLLMENT}
        mockPay
        chargeEnrollmentFee={
          extras.failEnrollment
            ? async () => {
                throw new Error("card declined");
              }
            : async () => ({ message: { mock: true, kind: "enrollment" } })
        }
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

describe("CheckoutModal matrícula", () => {
  beforeEach(() => {
    reservateRetryWait.wait = async () => undefined;
    useCartStore.setState({ lines: [silverLine], reservation: null });
  });

  afterEach(() => {
    cleanup();
    clearToasts();
    resetToastHostForTests();
    useCartStore.setState({ lines: [], reservation: null });
    vi.clearAllMocks();
  });

  it("muestra la línea atada y el total 115€", async () => {
    renderEnrollment(mockClient(), { skipCatalog: false });
    fireEvent.click(screen.getByRole("button", { name: /ver productos del carrito/i }));
    await waitFor(() => expect(screen.getByText(/matrícula · solo primer pago/i)).toBeTruthy());
    expect(screen.getByText("fijo")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /eliminar matrícula/i })).toBeNull();
    expect(screen.getAllByText(/115\s*€/).length).toBeGreaterThan(0);
  });

  it("oculta el combo Matrícula del catálogo", async () => {
    useCartStore.setState({ lines: [], reservation: null });
    renderEnrollment(mockClient(), { skipCatalog: false });
    await waitFor(() => expect(screen.getByRole("tab", { name: /paquetes/i })).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: /paquetes/i }));
    await waitFor(() => expect(screen.getByText(/bono 10 clases/i)).toBeTruthy());
    expect(screen.queryByRole("heading", { name: /^matrícula$/i })).toBeNull();
    expect(screen.queryByText(/^matrícula$/i)).toBeNull();
  });

  it("el descuento no aplica a la matrícula", async () => {
    const client = mockClient();
    renderEnrollment(client);
    await waitFor(() => expect(screen.getByText(/matrícula · solo primer pago/i)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /¿tienes un código de descuento/i }));
    fireEvent.change(screen.getByPlaceholderText(/código/i), { target: { value: "Familia10" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    await waitFor(() => expect(screen.getByText(/familia10/i)).toBeTruthy());
    expect(screen.getByText(/8[.,]50/)).toBeTruthy();
    expect(vi.mocked(client.checkDiscountCode!).mock.calls[0][0].lines).toEqual([
      { id: 1271, type: "membership" },
    ]);
  });

  it("con mockPay, Ir a pagar muestra el panel y no se queda revisando", async () => {
    renderEnrollment(mockClient(), { skipCatalog: false, failEnrollment: true });
    fireEvent.click(screen.getByRole("button", { name: /ver productos del carrito/i }));
    await waitFor(() => expect(screen.getByText(/matrícula · solo primer pago/i)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /ir a pagar/i }));
    await waitFor(() => expect(screen.getByText(/pago de prueba/i)).toBeTruthy());
    expect(screen.queryByText(/revisando tu compra/i)).toBeNull();
    expect((screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("un Pagar hace dos cargos: membresía recurrente y matrícula única", async () => {
    const client = mockClient();
    renderEnrollment(client);
    await waitFor(() => {
      expect((screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: /pagar/i }));
    await waitFor(() => expect(client.reservatePurchase).toHaveBeenCalledTimes(2));
    const [membership, enrollment] = vi.mocked(client.reservatePurchase!).mock.calls.map((call) => call[0]);
    expect(membership.lines.map((line) => line.id)).toEqual([1271]);
    expect(membership.subscribe).toBe(true);
    expect(enrollment.lines.map((line) => line.id)).toEqual([3491]);
    expect(enrollment.subscribe).toBe(false);
    expect(enrollment.discountCode).toBeNull();
    expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
  });

  it("si el segundo cobro falla muestra el aviso en español", async () => {
    const client = mockClient();
    renderEnrollment(client, { failEnrollment: true });
    await waitFor(() => {
      expect((screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: /pagar/i }));
    await waitFor(() => expect(screen.getAllByText(ENROLLMENT_CHARGE_FAILED_MESSAGE).length).toBeGreaterThan(0));
    expect(client.reservatePurchase).toHaveBeenCalled();
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0].lines[0]?.id).toBe(1271);
  });

  it("Socio Fundador no agrega matrícula", async () => {
    useCartStore.setState({
      lines: [
        {
          ...silverLine,
          id: 1203,
          key: "the-base:membership:1203",
          name: "Socio Fundador",
        },
      ],
      reservation: null,
    });
    renderEnrollment(mockClient());
    await waitFor(() => expect(screen.getByText(/socio fundador/i)).toBeTruthy());
    expect(screen.queryByText(/solo primer pago/i)).toBeNull();
  });
});
