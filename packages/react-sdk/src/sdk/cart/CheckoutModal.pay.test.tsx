import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutConfig, GafaClient, Meeting } from "../client/types";
import type { GafaPayIsland, GafaPayWidgetProps } from "../payments/gafaPay";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";
import { reservateRetryWait } from "./reservateRetry";

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

function renderPay(
  client: GafaClient,
  extras: {
    showMembershipOptions?: boolean;
    onClose?: () => void;
    meeting?: Meeting | null;
    seatObjectId?: number;
    seatLabel?: string;
  } = {},
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
        skipCatalog={true}
        meeting={extras.meeting}
        seatObjectId={extras.seatObjectId}
        seatLabel={extras.seatLabel}
        showMembershipOptions={extras.showMembershipOptions}
        onClose={extras.onClose ?? (() => undefined)}
      />
    </QueryClientProvider>,
  );
}

describe("CheckoutModal Stripe / GafaPay confirm", () => {
  let lastProps: GafaPayWidgetProps | undefined;

  beforeEach(() => {
    lastProps = undefined;
    useCartStore.setState({ lines: [cartLine], reservation: null });
    reservateRetryWait.wait = async () => undefined;
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
    reservateRetryWait.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
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

  it("en pago el detalle de productos arranca cerrado y se puede abrir", async () => {
    renderPay(mockClient());
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pagar/i })).toBeTruthy();
    });

    const aside = document.querySelector(".gafa-checkout__cart");
    expect(aside?.getAttribute("data-open")).not.toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /ver productos del carrito/i }));
    expect(aside?.getAttribute("data-open")).toBe("true");
    expect(screen.getByText("SCULPT")).toBeTruthy();
  });

  it("monta GafaPayFront con onStartPayAction (GafaPay lo llama sin optional chaining)", async () => {
    renderPay(mockClient());
    await waitUntilPayReady();

    expect(typeof lastProps?.onStartPayAction).toBe("function");
    expect(() => lastProps?.onStartPayAction()).not.toThrow();
    expect(lastProps?.order.lineItems[0]?.product_type).toBe("App\\Models\\Combos\\Combos");
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

  it("tras el cobro de GafaPay llama reservate (paymentByCard/Token) y muestra el thank you", async () => {
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
    expect(client.reservatePurchase).toHaveBeenCalled();
    expect(client.initialPurchase).not.toHaveBeenCalled();
    expect(screen.getByText(/orden #88/i)).toBeTruthy();
  });

  it("al pagar una clase manda el lugar elegido en reservate", async () => {
    const client = mockClient();
    renderPay(client, {
      meeting: {
        id: 849768,
        name: "HELIPUERTO BICI",
        startsAt: "2026-08-29T09:30:00",
        timezone: "America/Mexico_City",
        serviceName: "HELIPUERTO BICI",
      },
      seatObjectId: 42,
      seatLabel: "42",
    });
    await waitUntilPayReady();
    expect(screen.getByText(/Lugar 42/)).toBeTruthy();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };
    fireEvent.click(payButton());

    await waitFor(() => expect(client.reservatePurchase).toHaveBeenCalled());
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0]).toEqual(
      expect.objectContaining({ meetingId: 849768, seatObjectId: 42 }),
    );
  });

  it("payment_data es el `message` de GafaPay tal cual (v1: ht.payment_data = e.message)", async () => {
    const client = mockClient();
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({
        message: "NDk0MTE4X3x8X2NoXzNVNXJZ…",
        subscriptionId: null,
        recurringPayment: false,
        webToken: "test",
      });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(client.reservatePurchase).toHaveBeenCalled();
    });
    const payload = vi.mocked(client.reservatePurchase!).mock.calls[0][0];
    // Producción (Stripe viejo): el recibo base64 viaja como string plano.
    // webToken NO se manda (v1 lo ignora); subscriptionId va top-level.
    expect(payload.paymentData).toBe("NDk0MTE4X3x8X2NoXzNVNXJZ…");
    expect(payload.subscriptionId).toBeNull();
    expect(payload.subscribe).toBe(false);
    expect(payload.lines[0]).toEqual(
      expect.objectContaining({
        id: 971,
        type: "combo",
        amount: 1,
        name: "SCULPT",
        price: 275,
        companiesId: 1,
      }),
    );
  });

  it("carrito persistido sin raw: el JSON del item se resuelve del catálogo al pagar", async () => {
    // El carrito de localStorage puede venir de una versión sin `raw`.
    const client = mockClient({
      getCheckoutConfig: async () => ({
        ...checkoutConfig(),
        combos: [
          {
            id: 971,
            name: "SCULPT",
            type: "combo",
            price: 275,
            priceFinal: 275,
            raw: { id: 971, name: "SCULPT", credits: 1, expiration_days: 30, price_final: "275.00" },
          },
        ],
      }),
    });
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: "recibo" });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(client.reservatePurchase).toHaveBeenCalled();
    });
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0].lines[0]?.raw).toEqual({
      id: 971,
      name: "SCULPT",
      credits: 1,
      expiration_days: 30,
      price_final: "275.00",
    });
  });

  it("si GafaPay contesta con texto, payment_data va sin envolver", async () => {
    const client = mockClient();
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: "Se completó el pago." });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(client.reservatePurchase).toHaveBeenCalled();
    });
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0].paymentData).toBe(
      "Se completó el pago.",
    );
  });

  it("no manda checkout_token: eso registraba la compra como checkout de Recurrente", async () => {
    const client = mockClient();
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { id: "ch_123" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(client.reservatePurchase).toHaveBeenCalled();
    });
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0].checkoutToken).toBeUndefined();
    expect(client.initialPurchase).not.toHaveBeenCalled();
  });

  it("con Stripe no consulta initial-purchase-status", async () => {
    const poll = vi.fn(async () => ({ code: 1 }));
    const client = mockClient({
      pollInitialPurchaseStatus: poll,
    });
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { id: "ch_123" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(poll).not.toHaveBeenCalled();
  });

  it("si falta reservatePurchase no se queda en Procesando: muestra el error", async () => {
    const { reservatePurchase: _ignored, ...rest } = mockClient();
    renderPay(rest as GafaClient);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/ya fue cobrada/i)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /procesando/i })).toBeNull();
    expect(screen.getByRole("button", { name: /registrar compra/i })).toBeTruthy();
  });

  it("si reservate trae la reserva, la muestra en el thank you sin poll", async () => {
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
    const poll = vi.fn(async () => ({ code: 1, reservationId: 77 }));
    renderPay(
      mockClient({
        reservatePurchase: vi.fn(async () => ({ purchaseId: 88, reservationId: 77 })),
        pollInitialPurchaseStatus: poll,
      }),
    );
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/reserva confirmada/i)).toBeTruthy();
    });
    expect(screen.getByText(/reserva #77/i)).toBeTruthy();
    expect(poll).not.toHaveBeenCalled();
  });

  it("si Buq falla después del cobro, reintenta /reservate sin volver a Stripe", async () => {
    const reservatePurchase = vi
      .fn()
      .mockRejectedValueOnce(new Error("Server Error"))
      .mockResolvedValueOnce({ purchaseId: 88 });
    const client = mockClient({ reservatePurchase });
    const stripe = vi.fn(async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { id: "ch_123" } });
    });

    renderPay(client);
    await waitUntilPayReady();
    window._handleStripePayment = stripe;

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(stripe).toHaveBeenCalledTimes(1);
    expect(reservatePurchase).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: /registrar compra/i })).toBeNull();
  });

  it("mientras registra el cargo no deja cerrar y dice Registrando compra", async () => {
    const onClose = vi.fn();
    let release!: (value: { purchaseId: number }) => void;
    const reservatePurchase = vi.fn(
      () =>
        new Promise<{ purchaseId: number }>((resolve) => {
          release = resolve;
        }),
    );
    const client = mockClient({ reservatePurchase });

    renderPay(client, { onClose });
    await waitUntilPayReady();
    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { id: "ch_123" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/registrando compra/i)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /cerrar/i })).toBeNull();
    fireEvent.mouseDown(document.querySelector(".gafa-checkout-overlay")!);
    expect(onClose).not.toHaveBeenCalled();

    release({ purchaseId: 88 });
    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /cerrar/i })).toBeTruthy();
  });

  it("si /reservate falla 3 veces, pide registrar y no deja cerrar el overlay", async () => {
    const onClose = vi.fn();
    const reservatePurchase = vi.fn(async () => {
      throw new Error("Server Error");
    });
    const client = mockClient({ reservatePurchase });
    const stripe = vi.fn(async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { id: "ch_123" } });
    });

    renderPay(client, { onClose });
    await waitUntilPayReady();
    window._handleStripePayment = stripe;

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/ya fue cobrada/i)).toBeTruthy();
    });
    expect(stripe).toHaveBeenCalledTimes(1);
    expect(reservatePurchase).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: /registrar compra/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /cerrar/i })).toBeNull();
    expect(document.querySelector("[data-charge-hold='true']")).toBeTruthy();

    fireEvent.mouseDown(document.querySelector(".gafa-checkout-overlay")!);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CheckoutModal Recurrente", () => {
  let lastProps: GafaPayWidgetProps | undefined;

  beforeEach(() => {
    lastProps = undefined;
    useCartStore.setState({ lines: [cartLine], reservation: null });
    mocks.loadGafaPay.mockResolvedValue({
      React: { createElement: () => null },
      ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true },
      elements: { RecurrentePayment: function RecurrentePayment() {} },
    });
    mocks.mountGafaPayWidget.mockImplementation((_runtime, container, _slug, props: GafaPayWidgetProps): GafaPayIsland => {
      lastProps = props;
      if (container instanceof Element) {
        const wrap = document.createElement("div");
        wrap.className = "gafapay-recurrente";
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Pago con Tarjeta";
        button.addEventListener("click", () => {
          window.open("https://app.recurrente.com/checkout-session/chk_voltio");
          props.onStartPayAction();
          props.onCheckoutOpenAction?.({
            checkout_token: "chk_voltio",
            redirect: "https://app.recurrente.com/checkout-session/chk_voltio",
          });
        });
        wrap.appendChild(button);
        container.appendChild(wrap);
      }
      return {
        update: (next) => {
          lastProps = next;
        },
        unmount: () => undefined,
      };
    });
    mocks.waitForWidgetContent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
    vi.clearAllMocks();
  });

  function recurrenteConfig(): CheckoutConfig {
    return {
      ...checkoutConfig(),
      currency: { prefix: "Q", suffix: "GTQ", code: "GTQ" },
      paymentMethods: [{ id: 9, name: "Recurrente", slug: "recurrente" }],
    };
  }

  it("el CTA abre el pago con tarjeta, POSTea initial-purchase y no llama reservate", async () => {
    const client = mockClient({
      getCheckoutConfig: async () => recurrenteConfig(),
    });
    renderPay(client);

    const pays = await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: /pagar/i });
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      return buttons;
    });
    expect(document.body.textContent ?? "").not.toMatch(/Recurrente/);
    await waitFor(() => {
      expect((pays[0] as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(pays[0]);

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(client.initialPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ checkoutToken: "chk_voltio", paymentTypeId: 9 }),
    );
    expect(client.pollInitialPurchaseStatus).toHaveBeenCalled();
    expect(client.reservatePurchase).not.toHaveBeenCalled();
    expect(lastProps?.order.currency).toBe("GTQ");
    expect(lastProps?.termsAndConditions).toBe(true);
  });

  it("si se cierra la ventana de pago, el botón vuelve a quedar usable", async () => {
    const popup = { closed: false };
    const originalOpen = window.open;
    window.open = () => popup as Window;

    const client = mockClient({
      getCheckoutConfig: async () => recurrenteConfig(),
      pollInitialPurchaseStatus: vi.fn(() => new Promise(() => undefined)),
    });
    renderPay(client);

    const pay = await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: /pagar/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
      return buttons[0] as HTMLButtonElement;
    });
    await waitFor(() => expect(pay.disabled).toBe(false));

    fireEvent.click(pay);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /esperando el pago/i }).length).toBeGreaterThan(0);
    });

    popup.closed = true;

    await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: /pagar/i });
      expect(buttons.some((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    });
    expect(screen.queryByText(/esperando el pago/i)).toBeNull();
    expect(screen.queryByText(/gracias por tu compra/i)).toBeNull();

    window.open = originalOpen;
  });
});

const membershipLine: CartLine = {
  ...cartLine,
  key: "fitspin:membership:12",
  id: 12,
  type: "membership",
  name: "MEMBRESÍA CDMX",
  price: 3100,
  priceLabel: "$3,100",
};

describe("CheckoutModal membresía (guardar tarjeta + renovar)", () => {
  let lastProps: GafaPayWidgetProps | undefined;

  beforeEach(() => {
    lastProps = undefined;
    useCartStore.setState({ lines: [membershipLine], reservation: null });
    mocks.loadGafaPay.mockResolvedValue({
      React: { createElement: () => null },
      ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true },
      elements: { StripePayment: function StripePayment() {} },
    });
    mocks.mountGafaPayWidget.mockImplementation((_runtime, container, _slug, props: GafaPayWidgetProps): GafaPayIsland => {
      lastProps = props;
      if (container instanceof Element) {
        container.innerHTML = `
          <div class="gafapay-form__group is-checkbox">
            <input id="saveCard" type="checkbox" />
            <input id="recurringPayment" type="checkbox" />
          </div>
        `;
      }
      return {
        update: (next) => {
          lastProps = next;
        },
        unmount: () => undefined,
      };
    });
    mocks.waitForWidgetContent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
    delete window._handleStripePayment;
    vi.clearAllMocks();
  });

  it("las opciones van ON y ocultas; GafaPay recibe hasRecurringPayment", async () => {
    renderPay(mockClient());
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pagar/i })).toBeTruthy();
    });
    await waitFor(() => expect(lastProps?.hasRecurringPayment).toBe(true));
    expect(screen.queryByRole("button", { name: /opciones de la membresía/i })).toBeNull();
    expect(screen.queryByLabelText(/guardar mi tarjeta/i)).toBeNull();
    expect(screen.queryByLabelText(/renovar automáticamente/i)).toBeNull();
    expect(document.body.textContent ?? "").not.toMatch(/Recurrente/);
  });

  it("SHOW_MEMBERSHIP_OPTIONS muestra el link y los checks van ON", async () => {
    renderPay(mockClient(), { showMembershipOptions: true });
    await waitFor(() => expect(lastProps?.hasRecurringPayment).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /opciones de la membresía/i }));
    const save = screen.getByLabelText(/guardar mi tarjeta/i) as HTMLInputElement;
    const renew = screen.getByLabelText(/renovar automáticamente/i) as HTMLInputElement;
    expect(save.checked).toBe(true);
    expect(renew.checked).toBe(true);
    expect(save.className).toContain("gafa-check-input");
  });

  it("al pagar una membresía manda subscribe y set_payment en true", async () => {
    const client = mockClient();
    renderPay(client);
    await waitFor(() => expect((screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement).disabled).toBe(false));

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" }, recurringPayment: false });
    };
    fireEvent.click(screen.getByRole("button", { name: /pagar/i }));

    await waitFor(() => expect(client.reservatePurchase).toHaveBeenCalled());
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0]).toEqual(
      expect.objectContaining({ subscribe: true, setPayment: true }),
    );
  });

  it("si desmarcan renovar, reservate manda subscribe false", async () => {
    const client = mockClient();
    renderPay(client, { showMembershipOptions: true });
    await waitFor(() => expect((screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByRole("button", { name: /opciones de la membresía/i }));
    fireEvent.click(screen.getByLabelText(/renovar automáticamente/i));

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" }, recurringPayment: true });
    };
    fireEvent.click(screen.getByRole("button", { name: /pagar/i }));

    await waitFor(() => expect(client.reservatePurchase).toHaveBeenCalled());
    expect(vi.mocked(client.reservatePurchase!).mock.calls[0][0]).toEqual(
      expect.objectContaining({ subscribe: false, setPayment: true }),
    );
  });
});
