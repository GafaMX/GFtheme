import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem, CheckoutConfig, DiscountCodeResult, GafaClient, Meeting } from "../client/types";
import type { GafaPayIsland, GafaPayWidgetProps } from "../payments/gafaPay";
import { CheckoutModal, PAYPAL_CLOSE_HOLD_MS } from "../widgets/CheckoutModal";
import { useCartStore, type CartLine } from "./cartStore";
import { reservateRetryWait } from "./reservateRetry";
import { clearToasts } from "../toast/toastStore";
import { resetToastHostForTests } from "../toast/ToastHost";
import { resetStripeSessionFetchGuardForTests } from "../payments/stripeSessionGuard";

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
    previewPurchase: vi.fn(async () => undefined),
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
    seatObjectIds?: number[];
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
        seatObjectIds={extras.seatObjectIds}
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
      queueMicrotask(() => {
        props.onCheckoutOpenAction?.({ message: "chk_1", client_secret: "cs_test" });
      });
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
    clearToasts();
    resetToastHostForTests();
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

  it.each([true, false])("recupera compra pagada después de error (poll=%s)", async (registrationError) => {
    const listUserPurchases = vi.fn().mockResolvedValueOnce([]).mockImplementation(async () => [{
      id: 99, name: cartLine.name, total: cartLine.price, status: "Pagada", createdAt: new Date().toISOString(),
    }]);
    const client = mockClient({
      listUserPurchases,
      pollInitialPurchaseStatus: vi.fn(async () => {
        throw Object.assign(new Error("Validation"), { status: 422 });
      }),
    });
    renderPay(client);
    await waitUntilPayReady();
    window._handleStripePayment = async () => {
      if (registrationError) lastProps?.onGafaPaySuccessAction({ message: "receipt" });
      else lastProps?.onGafaPayErrAction({ message: "Error al cobrar" });
    };
    fireEvent.click(payButton());
    await waitFor(() => expect(screen.getByText(/orden #99/i)).toBeTruthy());
    expect(listUserPurchases).toHaveBeenCalledTimes(2);
  });

  it("no recupera una compra previa ni pendiente", async () => {
    const old = { id: 7, name: cartLine.name, total: cartLine.price, status: "Pagada", createdAt: new Date().toISOString() };
    const client = mockClient({ listUserPurchases: vi.fn().mockResolvedValueOnce([old]).mockResolvedValue([old, { ...old, id: 8, status: "Pendiente" }]) });
    renderPay(client);
    await waitUntilPayReady();
    window._handleStripePayment = async () => { lastProps?.onGafaPayErrAction({ message: "Error al cobrar" }); };
    fireEvent.click(payButton());
    await waitFor(() => expect(screen.getByText(/error al cobrar/i)).toBeTruthy());
    expect(screen.queryByText(/gracias por tu compra/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Cerrar", exact: true })).toBeTruthy();
  });

  it("initial-purchase lleva el discountCode aplicado", async () => {
    const client = mockClient({
      getCheckoutConfig: async () => ({ ...checkoutConfig(), discountCodesEnabled: true }),
      checkDiscountCode: async ({ code }) => ({ valid: true, code, discountType: "percent", discountNumber: 10, label: "Descuento aplicado" }),
    });
    renderPay(client);
    await waitUntilPayReady();
    fireEvent.click(screen.getByRole("button", { name: /¿tienes un código de descuento/i }));
    fireEvent.change(screen.getByPlaceholderText(/código/i), { target: { value: "PROMO" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    await waitFor(() => expect(screen.getByText(/descuento aplicado/i)).toBeTruthy());
    await waitFor(() =>
      expect(
        vi.mocked(client.initialPurchase!).mock.calls.some((call) => call[0].discountCode === "PROMO"),
      ).toBe(true),
    );
  });

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

  it("el código de descuento se puede abrir sin desplegar el carrito", async () => {
    renderPay(
      mockClient({
        getCheckoutConfig: async () => ({
          ...checkoutConfig(),
          discountCodesEnabled: true,
          urls: {
            ...checkoutConfig().urls,
            checkDiscountCode:
              "https://buq.partners/api/brand/fitspin/location/polanco/reservation/check-discount-code/_|_/4412",
          },
        }),
        checkDiscountCode: async () => ({ valid: false, code: "X", message: "no" }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pagar/i })).toBeTruthy();
    });

    const aside = document.querySelector(".gafa-checkout__cart");
    expect(aside?.getAttribute("data-open")).not.toBe("true");
    const discount = screen.getByRole("button", { name: /¿tienes un código de descuento\?/i });
    expect(discount.closest(".gafa-checkout-promo")?.getAttribute("data-kind")).toBe("discount");
    fireEvent.click(discount);
    expect(aside?.getAttribute("data-open")).not.toBe("true");
    expect(screen.getByPlaceholderText(/código/i)).toBeTruthy();
  });

  it("monta GafaPayFront con onStartPayAction (GafaPay lo llama sin optional chaining)", async () => {
    renderPay(mockClient());
    await waitUntilPayReady();

    expect(typeof lastProps?.onStartPayAction).toBe("function");
    expect(() => lastProps?.onStartPayAction()).not.toThrow();
    expect(lastProps?.order.lineItems[0]?.product_type).toBe("App\\Models\\Combos\\Combos");
  });

  it("si el formulario no carga a la primera, reintenta solo y habilita Pagar", async () => {
    mocks.waitForWidgetContent
      .mockRejectedValueOnce(new Error("No se pudo cargar el formulario de pago. Inténtalo de nuevo."))
      .mockResolvedValueOnce(undefined);

    renderPay(mockClient());
    await waitUntilPayReady();

    expect(mocks.loadGafaPay).toHaveBeenCalledTimes(1);
    expect(mocks.mountGafaPayWidget).toHaveBeenCalledTimes(1);
    expect(mocks.waitForWidgetContent).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: /reintentar/i })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("si el reintento también falla, muestra Reintentar y vuelve a montar al pulsar", async () => {
    mocks.waitForWidgetContent.mockRejectedValue(
      new Error("No se pudo cargar el formulario de pago. Inténtalo de nuevo."),
    );

    renderPay(mockClient());

    const retry = await waitFor(() => screen.getByRole("button", { name: /reintentar/i }));
    expect(screen.getAllByText(/no se pudo cargar el formulario de pago/i).length).toBeGreaterThan(0);
    expect(payButton().disabled).toBe(true);
    expect(mocks.loadGafaPay).toHaveBeenCalledTimes(1);

    mocks.waitForWidgetContent.mockResolvedValue(undefined);
    fireEvent.click(retry);
    await waitUntilPayReady();
    expect(screen.queryByRole("button", { name: /reintentar/i })).toBeNull();
    expect(mocks.loadGafaPay.mock.calls.length).toBe(2);
  });

  it("el CVC inválido sale en toast, sin ERROR-05 ni texto junto al botón", async () => {
    renderPay(mockClient());
    await waitUntilPayReady();

    lastProps?.onGafaPayErrAction({
      message:
        "Ocurrió un error al completar el pago con Stripe. ERROR-05: No se pudo crear la tarjeta. Your card's security code is invalid.",
    });

    await waitFor(() => {
      expect(document.querySelector(".gafa-toast")?.textContent).toMatch(/c[oó]digo de seguridad inválido/i);
    });
    expect(document.querySelector(".gafa-checkout__error")).toBeNull();
    expect(document.body.textContent ?? "").not.toMatch(/ERROR-05/);
    expect(document.body.textContent ?? "").not.toMatch(/runtime de pago/i);
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

  it("no cobra si Buq bloquea el paquete o la membresía", async () => {
    const stripe = vi.fn();
    window._handleStripePayment = stripe;
    const client = mockClient({
      previewPurchase: vi.fn(async () => {
        throw new Error("Este producto no puede ser comprado porque ha llegado a su límite.");
      }),
    });
    renderPay(client);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent ?? "").toMatch(/ha llegado a su límite/i);
    });
    expect(screen.getByRole("heading", { name: /lo sentimos/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pagar/i })).toBeNull();
    expect(stripe).not.toHaveBeenCalled();
    expect(client.reservatePurchase).not.toHaveBeenCalled();
    expect(mocks.loadGafaPay).not.toHaveBeenCalled();
    expect(document.querySelector("[data-charge-hold='true']")).toBeNull();
  });

  it("el preflight pasa antes de abrir Stripe", async () => {
    const order: string[] = [];
    const client = mockClient({
      previewPurchase: vi.fn(async () => {
        order.push("preview");
      }),
    });
    renderPay(client);
    await waitUntilPayReady();

    window._handleStripePayment = async () => {
      order.push("stripe");
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(order).toEqual(["preview", "stripe"]);
  });

  it("al crear la sesión POSTea initial-purchase y al confirmar polla el status (no reservate)", async () => {
    const client = mockClient();
    renderPay(client);
    await waitUntilPayReady();
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(client.pollInitialPurchaseStatus).toHaveBeenCalled();
    expect(client.reservatePurchase).not.toHaveBeenCalled();
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

    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
    expect(vi.mocked(client.initialPurchase!).mock.calls[0][0]).toEqual(
      expect.objectContaining({ meetingId: 849768, seatObjectId: 42 }),
    );
  });

  it("al pagar invitados manda los N lugares", async () => {
    const client = mockClient();
    renderPay(client, {
      meeting: {
        id: 849768,
        name: "HELIPUERTO BICI",
        startsAt: "2026-08-29T09:30:00",
        timezone: "America/Mexico_City",
        serviceName: "HELIPUERTO BICI",
      },
      seatObjectIds: [10, 11, 12],
      seatLabel: "10, 11 y 12",
    });
    await waitUntilPayReady();
    expect(screen.getByText(/Lugares 10, 11 y 12/)).toBeTruthy();

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };
    fireEvent.click(payButton());

    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
    expect(vi.mocked(client.initialPurchase!).mock.calls[0][0]).toEqual(
      expect.objectContaining({ meetingId: 849768, seatObjectIds: [10, 11, 12] }),
    );
  });

  it("initial-purchase lleva el checkout_token de la sesión (message del widget)", async () => {
    const client = mockClient();
    renderPay(client);
    await waitUntilPayReady();

    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
    const payload = vi.mocked(client.initialPurchase!).mock.calls[0][0];
    expect(payload.checkoutToken).toBe("chk_1");
    expect(payload.paymentData).toEqual(expect.objectContaining({ message: "chk_1" }));
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
      expect(client.initialPurchase).toHaveBeenCalled();
    });
    expect(vi.mocked(client.initialPurchase!).mock.calls[0][0].lines[0]?.raw).toEqual({
      id: 971,
      name: "SCULPT",
      credits: 1,
      expiration_days: 30,
      price_final: "275.00",
    });
  });

  it("el payment-success no vuelve a POSTear reservate: cierra con el poll", async () => {
    const client = mockClient();
    renderPay(client);
    await waitUntilPayReady();
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: "Se completó el pago." });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(client.pollInitialPurchaseStatus).toHaveBeenCalled();
    expect(client.reservatePurchase).not.toHaveBeenCalled();
  });

  it("Stripe manda checkout_token (message de initial-payment-created) y polla el status", async () => {
    const poll = vi.fn(async () => ({ code: 1 }));
    const client = mockClient({
      pollInitialPurchaseStatus: poll,
    });
    renderPay(client);
    await waitUntilPayReady();
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
    expect(vi.mocked(client.initialPurchase!).mock.calls[0][0].checkoutToken).toBe("chk_1");

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { id: "ch_123" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(poll).toHaveBeenCalled();
    expect(client.reservatePurchase).not.toHaveBeenCalled();
  });

  it("si falta initialPurchase no se queda en Procesando: muestra el error", async () => {
    const { initialPurchase: _ignored, ...rest } = mockClient();
    renderPay(rest as GafaClient);
    await waitUntilPayReady();

    await waitFor(() => {
      expect(screen.getByText(/ya fue cobrada|no tiene configurado el pago|no pudimos iniciar el pago/i)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /procesando/i })).toBeNull();
  });

  it("si el poll trae la reserva, la muestra en el thank you", async () => {
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
        pollInitialPurchaseStatus: poll,
      }),
    );
    await waitUntilPayReady();
    await waitFor(() => expect(poll).not.toHaveBeenCalled());

    window._handleStripePayment = async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { stripeToken: "tok_visa" } });
    };

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/reserva confirmada/i)).toBeTruthy();
    });
    expect(screen.getByText(/reserva #77/i)).toBeTruthy();
    expect(poll).toHaveBeenCalled();
  });

  it("si el poll queda pendiente y luego confirma, no vuelve a Stripe", async () => {
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ code: 0 })
      .mockResolvedValueOnce({ code: 1, reservationId: 77 });
    const client = mockClient({ pollInitialPurchaseStatus: poll });
    const stripe = vi.fn(async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { id: "ch_123" } });
    });

    renderPay(client);
    await waitUntilPayReady();
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
    window._handleStripePayment = stripe;

    fireEvent.click(payButton());

    await waitFor(
      () => {
        expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
      },
      { timeout: 8000 },
    );
    expect(stripe).toHaveBeenCalledTimes(1);
    expect(poll).toHaveBeenCalledTimes(2);
    expect(client.reservatePurchase).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /registrar compra/i })).toBeNull();
  }, 12_000);

  it("mientras registra el cargo no deja cerrar y dice Registrando compra", async () => {
    const onClose = vi.fn();
    let release!: (value: { code: number; reservationId?: number }) => void;
    const pollInitialPurchaseStatus = vi.fn(
      () =>
        new Promise<{ code: number; reservationId?: number }>((resolve) => {
          release = resolve;
        }),
    );
    const client = mockClient({ pollInitialPurchaseStatus });

    renderPay(client, { onClose });
    await waitUntilPayReady();
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
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

    release({ code: 1, reservationId: 77 });
    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Cerrar", exact: true })).toBeTruthy();
  });

  it("si el poll falla, pide registrar y permite cerrar el overlay", async () => {
    const onClose = vi.fn();
    const pollInitialPurchaseStatus = vi.fn(async () => {
      throw new Error("Server Error");
    });
    const client = mockClient({ pollInitialPurchaseStatus });
    const stripe = vi.fn(async () => {
      lastProps?.onStartPayAction();
      lastProps?.onGafaPaySuccessAction({ message: { id: "ch_123" } });
    });

    renderPay(client, { onClose });
    await waitUntilPayReady();
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
    window._handleStripePayment = stripe;

    fireEvent.click(payButton());

    await waitFor(() => {
      expect(screen.getByText(/ya fue cobrada/i)).toBeTruthy();
    });
    expect(stripe).toHaveBeenCalledTimes(1);
    expect(pollInitialPurchaseStatus).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /revisar pago|registrar compra/i })).toBeTruthy();
    expect(document.querySelector("[data-charge-hold='true']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar", exact: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
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

describe("CheckoutModal PayPal CTA", () => {
  const originalOpen = window.open;
  let lastPaypalProps: GafaPayWidgetProps | undefined;

  beforeEach(() => {
    lastPaypalProps = undefined;
    useCartStore.setState({ lines: [cartLine], reservation: null });
    const initXO = vi.fn(() => {
      window.open("https://www.paypal.com/checkoutnow");
    });
    (window as unknown as { paypal: unknown }).paypal = {
      Button: {
        render: (_options: unknown, selector: string | Element) => {
          const node = typeof selector === "string" ? document.querySelector(selector) : selector;
          if (node instanceof HTMLElement) {
            node.innerHTML = `<div class="paypal-button" role="button">PayPal</div>`;
          }
        },
      },
      checkout: { initXO, startFlow: vi.fn(), closeXO: vi.fn() },
    };
    mocks.loadGafaPay.mockResolvedValue({
      React: { createElement: () => null },
      ReactDOM: { render: () => undefined, unmountComponentAtNode: () => true },
      elements: { PaypalPayment: function PaypalPayment() {} },
    });
    mocks.mountGafaPayWidget.mockImplementation((_runtime, container, _slug, props: GafaPayWidgetProps): GafaPayIsland => {
      lastPaypalProps = props;
      if (container instanceof Element) {
        container.innerHTML = `<div id="paypal"></div>`;
        const host = container.querySelector("#paypal");
        const paypal = (window as unknown as {
          paypal?: { Button?: { render?: (options: unknown, selector: string | Element) => unknown } };
        }).paypal;
        paypal?.Button?.render?.(
          {
            payment: () => {
              props.onStartPayAction();
              return "PAY-1";
            },
            onCancel: () => props.onGafaPayErrAction({ message: "Se canceló el pago con PayPal." }),
          },
          host ?? "#paypal",
        );
      }
      return { update: () => undefined, unmount: () => undefined };
    });
    mocks.waitForWidgetContent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    useCartStore.setState({ lines: [], reservation: null });
    window.open = originalOpen;
    delete (window as unknown as { paypal?: unknown }).paypal;
    vi.clearAllMocks();
  });

  function paypalOnlyClient() {
    return mockClient({
      getCheckoutConfig: async () => ({
        ...checkoutConfig(),
        paymentMethods: [{ id: 3, name: "PayPal", slug: "paypal", gafapayId: 2, order: 1 }],
      }),
    });
  }

  it("cerrar la ventana de PayPal no suelta Pagar: espera a GafaPay", async () => {
    const popup = { closed: false };
    const originalOpen = window.open;
    window.open = () => popup as Window;

    renderPay(paypalOnlyClient());
    const pay = await waitFor(() => screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement);
    await waitFor(() => expect(pay.disabled).toBe(false));

    fireEvent.click(pay);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /esperando paypal/i })).toBeTruthy();
    });

    popup.closed = true;
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(screen.getByRole("button", { name: /esperando paypal/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pagar \$/i })).toBeNull();

    lastPaypalProps?.onGafaPayErrAction({ message: "Se canceló el pago con PayPal." });

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
    expect(screen.queryByText(/esperando paypal/i)).toBeNull();
    expect(screen.queryByText(/gracias por tu compra/i)).toBeNull();

    window.open = originalOpen;
  });

  it("durante el hold, un segundo clic no abre otro PayPal", async () => {
    const popup = { closed: false };
    const originalOpen = window.open;
    window.open = () => popup as Window;
    const initXO = (window as unknown as { paypal: { checkout: { initXO: ReturnType<typeof vi.fn> } } })
      .paypal.checkout.initXO;

    renderPay(paypalOnlyClient());
    const pay = await waitFor(() => screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement);
    await waitFor(() => expect(pay.disabled).toBe(false));

    fireEvent.click(pay);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /esperando paypal/i })).toBeTruthy();
    });
    expect(initXO).toHaveBeenCalledTimes(1);

    popup.closed = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(document.querySelector(".gafa-checkout-paymount")?.getAttribute("data-busy")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /esperando paypal/i }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(initXO).toHaveBeenCalledTimes(1);

    window.open = originalOpen;
  });

  it("si PayPal cierra y GafaPay confirma, registra una sola compra", async () => {
    const popup = { closed: false };
    const originalOpen = window.open;
    window.open = () => popup as Window;
    const client = paypalOnlyClient();

    renderPay(client);
    const pay = await waitFor(() => screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement);
    await waitFor(() => expect(pay.disabled).toBe(false));

    fireEvent.click(pay);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /esperando paypal/i })).toBeTruthy();
    });

    popup.closed = true;
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.getByRole("button", { name: /esperando paypal/i })).toBeTruthy();

    lastPaypalProps?.onGafaPaySuccessAction({ message: "NDk0MTE4X3x8X2NoXzNVNXJZ" });

    await waitFor(() => {
      expect(screen.getByText(/gracias por tu compra/i)).toBeTruthy();
    });
    expect(client.reservatePurchase).toHaveBeenCalledTimes(1);

    window.open = originalOpen;
  });

  it("si GafaPay no contesta, el hold suelta Pagar sin otro cargo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const popup = { closed: false };
    const originalOpen = window.open;
    window.open = () => popup as Window;

    try {
      renderPay(paypalOnlyClient());
      const pay = await waitFor(() => screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement);
      await waitFor(() => expect(pay.disabled).toBe(false));

      fireEvent.click(pay);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /esperando paypal/i })).toBeTruthy();
      });

      popup.closed = true;
      await vi.advanceTimersByTimeAsync(400);
      expect(screen.getByRole("button", { name: /esperando paypal/i })).toBeTruthy();

      await vi.advanceTimersByTimeAsync(PAYPAL_CLOSE_HOLD_MS);
      await waitFor(() => {
        const button = screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement;
        expect(button.disabled).toBe(false);
      });
      expect(screen.queryByText(/gracias por tu compra/i)).toBeNull();
    } finally {
      window.open = originalOpen;
      vi.useRealTimers();
    }
  });

  it("si GafaPay cancela PayPal, el CTA vuelve a Pagar", async () => {
    renderPay(paypalOnlyClient());
    const pay = await waitFor(() => screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement);
    await waitFor(() => expect(pay.disabled).toBe(false));
    await waitFor(() => expect(document.querySelector("#gafa-paypal-cta-hit .paypal-button")).toBeTruthy());

    fireEvent.click(pay);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /esperando paypal/i })).toBeTruthy();
    });

    lastPaypalProps?.onGafaPayErrAction({ message: "Se canceló el pago con PayPal." });

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
    });
    expect(screen.queryByText(/esperando paypal/i)).toBeNull();
    expect(screen.queryByText(/se canceló el pago con paypal/i)).toBeNull();
  });

  it("si PayPal no abre ventana, no se queda en Procesando", async () => {
    mocks.mountGafaPayWidget.mockImplementation((_runtime, container): GafaPayIsland => {
      if (container instanceof Element) {
        container.innerHTML = `<div id="paypal"></div>`;
      }
      return { update: () => undefined, unmount: () => undefined };
    });

    renderPay(paypalOnlyClient());
    const pay = await waitFor(() => screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement);
    await waitFor(() => expect(pay.disabled).toBe(false));

    fireEvent.click(pay);

    await waitFor(() => {
      expect(screen.getByText(/no pudimos abrir paypal/i)).toBeTruthy();
    });
    expect(screen.queryByText(/esperando paypal/i)).toBeNull();
    expect(screen.queryByText(/^procesando/i)).toBeNull();
    expect((screen.getByRole("button", { name: /pagar \$/i }) as HTMLButtonElement).disabled).toBe(false);
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
  raw: { subscribable: true, expiration_days: 30 },
};

describe("CheckoutModal membresía (guardar tarjeta + renovar)", () => {
  let lastProps: GafaPayWidgetProps | undefined;
  const membershipClient = (overrides: Partial<GafaClient> = {}) => mockClient({
    listMemberships: async () => [{
      id: membershipLine.id, name: membershipLine.name, type: "membership",
      can_subscribe: true, subscribable: true, expirationDays: 30,
    }],
    ...overrides,
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
  }

  const pay = () => screen.getByRole("button", { name: /^pagar/i }) as HTMLButtonElement;
  const ready = () => waitFor(() => expect(pay().disabled).toBe(false));

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
      queueMicrotask(() => {
        props.onCheckoutOpenAction?.({ message: "chk_1", client_secret: "cs_test" });
      });
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

  it("muestra Pago recurrente marcado por defecto sin SHOW_MEMBERSHIP_OPTIONS", async () => {
    renderPay(membershipClient());
    const input = await screen.findByRole("checkbox", { name: "Pago recurrente" }) as HTMLInputElement;
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(false);
    await waitFor(() => expect(lastProps?.hasRecurringPayment).toBe(true));
    expect(lastProps?.stripeCheckoutState?.recurringPayment).toBe(true);
    expect(lastProps?.paymentFrequency).toBe("30");
    expect(input.closest("label")?.className).toBe("gafa-check-row");
    fireEvent.click(screen.getByText("Pago recurrente"));
    expect(useCartStore.getState().lines[0].autoRenew).toBe(false);
    await ready();
    const unchecked = screen.getByRole("checkbox", { name: "Pago recurrente" }) as HTMLInputElement;
    expect(unchecked.disabled).toBe(false);
    expect(lastProps?.stripeCheckoutState?.recurringPayment).toBe(false);
    fireEvent.click(screen.getByText("Pago recurrente"));
    expect(useCartStore.getState().lines[0].autoRenew).toBe(true);
  });

  it.each(["catalog", "config", "catalog raw", "config raw"])(
    "can_subscribe actual de %s manda sobre el raw persistido y subscribable",
    async (source) => {
      for (const canSubscribe of [false, true]) {
        useCartStore.setState({ lines: [{
          ...membershipLine,
          raw: { subscribable: !canSubscribe, can_subscribe: !canSubscribe, expiration_days: 30 },
        }] });
        const item: CatalogItem = {
          id: membershipLine.id, name: membershipLine.name, type: "membership",
          subscribable: !canSubscribe, expirationDays: 30,
          ...(source.endsWith("raw")
            ? { raw: { can_subscribe: canSubscribe } }
            : { can_subscribe: canSubscribe }),
        };
        const client = membershipClient({
          listMemberships: async () => {
            if (source.startsWith("catalog")) return [item];
            throw new Error("Catálogo no disponible");
          },
          getCheckoutConfig: async () => ({
            ...checkoutConfig(), memberships: source.startsWith("config") ? [item] : [],
          }),
        });
        const view = renderPay(client);
        await ready();
        expect(Boolean(screen.queryByRole("checkbox", { name: "Pago recurrente" }))).toBe(canSubscribe);
        expect(lastProps?.hasRecurringPayment).toBe(canSubscribe);
        expect(lastProps?.paymentFrequency).toBe(canSubscribe ? "30" : null);
        expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({
          subscribe: canSubscribe,
          lines: [expect.objectContaining({ raw: expect.objectContaining({ can_subscribe: canSubscribe }) })],
        }));
        for (const [payload] of vi.mocked(client.previewPurchase!).mock.calls) {
          expect(payload.subscribe).toBe(canSubscribe);
        }
        view.unmount();
      }
    },
  );

  it.each([true, false, undefined, "error"] as const)(
    "catálogo lento: skeleton y sin Stripe ni Pagar hasta resolver can_subscribe=%s",
    async (result) => {
      const catalog = deferred<CatalogItem[]>();
      const config = vi.fn(async () => checkoutConfig()); // create-form-template no trae membresías.
      useCartStore.setState({ lines: [{
        ...membershipLine, raw: { subscribable: true, can_subscribe: true, expiration_days: 30 },
      }] });
      const client = membershipClient({ getCheckoutConfig: config, listMemberships: () => catalog.promise });
      renderPay(client);
      await waitFor(() => expect(config).toHaveBeenCalled());
      expect(screen.getByText("Revisando tu compra…")).toBeTruthy();
      expect(pay().disabled).toBe(true);
      expect(screen.queryByRole("checkbox", { name: "Pago recurrente" })).toBeNull();
      expect(mocks.mountGafaPayWidget).not.toHaveBeenCalled();
      expect(client.previewPurchase).not.toHaveBeenCalled();
      expect(client.initialPurchase).not.toHaveBeenCalled();
      fireEvent.click(pay());
      expect(client.initialPurchase).not.toHaveBeenCalled();

      await act(async () => {
        if (result === "error") catalog.reject(new Error("Catálogo no disponible"));
        else catalog.resolve([{
          id: membershipLine.id, name: membershipLine.name, type: "membership",
          subscribable: true, can_subscribe: result, expirationDays: 30,
        }]);
      });
      await ready();
      expect(mocks.mountGafaPayWidget).toHaveBeenCalledTimes(1);
      expect(lastProps?.hasRecurringPayment).toBe(result === true || result === "error");
      expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ subscribe: result === true || result === "error" }));
    },
  );

  it.each([false, true])("espera el catálogo aunque config tenga can_subscribe=%s; OK sin dato fuerza pago único", async (canSubscribe) => {
    const catalog = deferred<CatalogItem[]>();
    const getCheckoutConfig = vi.fn(async () => ({ ...checkoutConfig(), memberships: [{
      id: membershipLine.id, name: membershipLine.name, can_subscribe: canSubscribe,
    }] }));
    const client = membershipClient({ listMemberships: () => catalog.promise, getCheckoutConfig });
    renderPay(client);
    await waitFor(() => expect(getCheckoutConfig).toHaveBeenCalled());
    expect(pay().disabled).toBe(true);
    expect(mocks.mountGafaPayWidget).not.toHaveBeenCalled();
    await act(async () => catalog.resolve([]));
    await ready();
    expect(lastProps?.hasRecurringPayment).toBe(false);
    expect(lastProps?.paymentFrequency).toBeNull();
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ subscribe: false }));
  });

  it.each([undefined, null, 0, 1, "false", "true", {}, []])("catálogo OK con can_subscribe no booleano (%s) fuerza pago único pese a datos antiguos", async (canSubscribe) => {
    useCartStore.setState({ lines: [{
      ...membershipLine, raw: { can_subscribe: true, subscribable: true, expiration_days: 30 },
    }] });
    const client = membershipClient({ listMemberships: async () => [{
      id: membershipLine.id, name: membershipLine.name,
      raw: { can_subscribe: canSubscribe, subscribable: true },
    }] });
    renderPay(client);
    await ready();
    expect(screen.queryByRole("checkbox", { name: "Pago recurrente" })).toBeNull();
    expect(lastProps?.hasRecurringPayment).toBe(false);
    expect(lastProps?.stripeCheckoutState?.recurringPayment).toBe(false);
    expect(lastProps?.paymentFrequency).toBeNull();
    const confirm = vi.fn();
    window._handleStripePayment = confirm;
    fireEvent.click(pay());
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    for (const [payload] of [...vi.mocked(client.initialPurchase!).mock.calls, ...vi.mocked(client.previewPurchase!).mock.calls]) {
      expect(payload.subscribe).toBe(false);
      expect(payload.lines[0].raw?.can_subscribe).toBe(false);
    }
  });

  it.each([false, true, undefined])("solo el ERROR del catálogo permite fallback a subscribable=%s", async (subscribable) => {
    useCartStore.setState({ lines: [{
      ...membershipLine, raw: { can_subscribe: true, subscribable, expiration_days: 30 },
    }] });
    const client = membershipClient({ listMemberships: async () => { throw new Error("Catálogo no disponible"); } });
    renderPay(client);
    await ready();
    expect(lastProps?.hasRecurringPayment).toBe(subscribable === true);
    expect(Boolean(screen.queryByRole("checkbox", { name: "Pago recurrente" }))).toBe(subscribable === true);
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ subscribe: subscribable === true }));
  });

  it("un ERROR del catálogo conserva el fallback subscribable de config sin raw en el carrito", async () => {
    useCartStore.setState({ lines: [{ ...membershipLine, raw: undefined }] });
    const client = membershipClient({
      listMemberships: async () => { throw new Error("Catálogo no disponible"); },
      getCheckoutConfig: async () => ({ ...checkoutConfig(), memberships: [{
        id: membershipLine.id, name: membershipLine.name, subscribable: true, expirationDays: 30,
      }] }),
    });
    renderPay(client);
    await ready();
    expect(lastProps?.hasRecurringPayment).toBe(true);
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ subscribe: true }));
  });

  it.each([
    { autoRenew: undefined, raw: undefined },
    { autoRenew: false, raw: undefined },
    { autoRenew: undefined, raw: { subscribable: true, expiration_days: 30 } },
    { autoRenew: false, raw: { subscribable: true, expiration_days: 30 } },
  ])("recupera del catálogo la membresía sin raw y respeta autoRenew=$autoRenew (raw=$raw)", async ({ autoRenew, raw }) => {
    useCartStore.setState({ lines: [{ ...membershipLine, raw: undefined, autoRenew }] });
    const client = membershipClient({
      listMemberships: async () => [{
        id: membershipLine.id, type: "membership", name: membershipLine.name,
        can_subscribe: true, subscribable: true, expirationDays: 30,
        raw,
      }],
    });
    renderPay(client);
    const input = await screen.findByRole("checkbox", { name: "Pago recurrente" }) as HTMLInputElement;
    await ready();
    expect(input.checked).toBe(autoRenew !== false);
    expect(lastProps?.hasRecurringPayment).toBe(autoRenew !== false);
    expect(lastProps?.paymentFrequency).toBe(autoRenew !== false ? "30" : null);
    await waitFor(() => expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({
      subscribe: autoRenew !== false,
      lines: [expect.objectContaining({ raw: expect.objectContaining({ subscribable: true, expiration_days: 30 }) })],
    })));
  });

  it("bloquea ambos controles y el handler desde la confirmación hasta resolver el cargo", async () => {
    const status = deferred<{ code: number; reservationId: number }>();
    const client = membershipClient({ pollInitialPurchaseStatus: vi.fn(() => status.promise) });
    renderPay(client, { showMembershipOptions: true });
    await ready();
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /opciones de la membresía/i }));
    const visible = screen.getByRole("checkbox", { name: "Pago recurrente" }) as HTMLInputElement;
    const legacy = screen.getByLabelText(/renovar automáticamente/i) as HTMLInputElement;
    const props = lastProps!;
    const confirm = vi.fn(() => props.onStartPayAction());
    window._handleStripePayment = confirm;
    const cta = pay();
    fireEvent.click(cta);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(visible.disabled).toBe(true);
    expect(legacy.disabled).toBe(true);
    for (const control of [visible, legacy]) fireEvent.click(control);
    act(() => props.changePaymentSystemProperties?.({ recurringPayment: false }));
    act(() => props.onGafaPaySuccessAction({ message: "paid" }));
    await act(async () => { await props.onInitialPaymentUpdated?.({ message: "chk_late" }); });
    for (const control of [visible, legacy]) fireEvent.click(control);
    expect(visible.checked).toBe(true);
    expect(legacy.checked).toBe(true);
    expect(mocks.mountGafaPayWidget).toHaveBeenCalledTimes(1);
    expect(client.initialPurchase).toHaveBeenCalledTimes(1);
    expect(cta.disabled).toBe(true);
    fireEvent.click(cta);
    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => status.resolve({ code: 1, reservationId: 77 }));
    await screen.findByText(/gracias por tu compra/i);
    expect(client.pollInitialPurchaseStatus).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("descarta el cupón recurrente tardío y lo revalida tras opt-out (respuesta antigua primero=%s)", async (oldFirst) => {
    const old = deferred<DiscountCodeResult>();
    const current = deferred<DiscountCodeResult>();
    const check = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    let session = 0;
    mocks.mountGafaPayWidget.mockImplementation((_runtime, container, _slug, props: GafaPayWidgetProps): GafaPayIsland => {
      lastProps = props;
      const token = `chk_${++session}`;
      container.innerHTML = '<iframe title="Stripe" />';
      queueMicrotask(() => props.onCheckoutOpenAction?.({ message: token }));
      return { update: () => undefined, unmount: () => container.replaceChildren() };
    });
    const client = membershipClient({
      getCheckoutConfig: async () => ({ ...checkoutConfig(), discountCodesEnabled: true }),
      initialPurchase: vi.fn(async (payload) => ({ purchaseId: 88, checkoutToken: payload.checkoutToken })),
      checkDiscountCode: check,
    });
    const events: unknown[] = [];
    const listener = (event: Event) => events.push((event as CustomEvent).detail);
    window.addEventListener("buq__discount_added", listener);
    try {
      renderPay(client);
      await ready();
      await waitFor(() => expect(client.initialPurchase).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole("button", { name: /¿tienes un código de descuento/i }));
      fireEvent.change(screen.getByPlaceholderText(/código/i), { target: { value: "PROMO" } });
      fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
      expect(check).toHaveBeenLastCalledWith(expect.objectContaining({ checkoutToken: "chk_1" }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Pago recurrente" }));
      await waitFor(() => expect(check).toHaveBeenCalledTimes(2));
      expect(check).toHaveBeenLastCalledWith(expect.objectContaining({ checkoutToken: "chk_2" }));
      // El update del mismo checkout puede volver a registrar la compra
      // mientras se valida el cupón; sigue siendo su sesión de origen.
      await act(async () => { await lastProps?.onInitialPaymentUpdated?.({ message: "chk_2" }); });
      const stale = { valid: true, code: "PROMO", checkoutToken: "chk_recurring", clientSecret: "cs_recurring" };
      const single = { valid: true, code: "PROMO", discountType: "percent", discountNumber: 10, checkoutToken: "chk_single_discount", clientSecret: "cs_single" };
      if (oldFirst) await act(async () => old.resolve(stale));
      await act(async () => current.resolve(single));
      if (!oldFirst) await act(async () => old.resolve(stale));
      await ready();
      expect(events).toEqual([{ checkout_token: "chk_single_discount", client_secret: "cs_single", previous_checkout_token: "chk_2" }]);
      expect(pay().textContent).toContain("$2,790");
      expect(lastProps?.hasRecurringPayment).toBe(false);
      expect((screen.getByRole("checkbox", { name: "Pago recurrente" }) as HTMLInputElement).checked).toBe(false);
      expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({
        checkoutToken: "chk_single_discount", subscribe: false, discountCode: "PROMO",
      }));
      const confirm = vi.fn(() => lastProps?.onGafaPaySuccessAction({ message: "single" }));
      window._handleStripePayment = confirm;
      fireEvent.click(pay());
      await screen.findByText(/gracias por tu compra/i);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(client.pollInitialPurchaseStatus).toHaveBeenCalledWith(expect.objectContaining({ checkoutToken: "chk_single_discount" }));
    } finally {
      window.removeEventListener("buq__discount_added", listener);
    }
  });

  it("remonta Stripe al alternar y conserva la casilla disponible incluso sin updated", async () => {
    const actual = await vi.importActual<typeof import("../payments/gafaPay")>("../payments/gafaPay");
    const elements: HTMLElement[] = [];
    mocks.mountGafaPayWidget.mockImplementation((runtime, container, slug, props: GafaPayWidgetProps) => {
      lastProps = props;
      const island = actual.mountGafaPayWidget(runtime, container, slug, props);
      elements.push(container.querySelector("stripe-payment-element")!);
      return island;
    });
    renderPay(membershipClient());
    await waitFor(() => expect(elements).toHaveLength(1));
    // Representa la sesión alojada dentro del elemento anterior.
    elements[0]!.appendChild(Object.assign(document.createElement("iframe"), { title: "cs_anterior" }));
    for (const checked of [false, true, false, true]) {
      const previous = elements.at(-1)!;
      const input = screen.getByRole("checkbox", { name: "Pago recurrente" }) as HTMLInputElement;
      expect(input.disabled).toBe(false);
      fireEvent.click(input);
      await waitFor(() => expect(elements.at(-1)).not.toBe(previous));
      const current = elements.at(-1)!;
      expect(previous.isConnected).toBe(false);
      expect(current.querySelector("iframe")).toBeNull();
      expect(current.getAttribute("has-recurring-payment")).toBe(String(checked));
      expect(current.getAttribute("payment-frequency")).toBe(checked ? "30" : null);
      expect(input.checked).toBe(checked);
      expect(useCartStore.getState().lines[0]?.autoRenew).toBe(checked);
    }
  });

  it("conserva la baja tras +/- y remontar el checkout; ningún montaje vuelve a activar recurrencia", async () => {
    const client = membershipClient();
    const view = renderPay(client);
    await waitFor(() => expect(lastProps?.hasRecurringPayment).toBe(true));
    fireEvent.click(screen.getByRole("checkbox", { name: "Pago recurrente" }));
    await waitFor(() => expect(lastProps?.hasRecurringPayment).toBe(false));
    mocks.mountGafaPayWidget.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /ver productos del carrito/i }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar uno" }));
    expect(useCartStore.getState().lines[0]?.amount).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Quitar uno" }));
    expect(useCartStore.getState().lines[0]?.amount).toBe(1);
    view.unmount();
    renderPay(client);
    await waitFor(() => expect(mocks.mountGafaPayWidget).toHaveBeenCalled());
    expect((screen.getByRole("checkbox", { name: "Pago recurrente" }) as HTMLInputElement).checked).toBe(false);
    for (const call of mocks.mountGafaPayWidget.mock.calls) {
      expect(call[3].hasRecurringPayment).toBe(false);
      expect(call[3].paymentFrequency).toBeNull();
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "Pago recurrente" }));
    await waitFor(() => expect(lastProps?.hasRecurringPayment).toBe(true));
  });

  it.each([false, 0, "0", "false", undefined])("membresía no suscribible (%s) cobra una vez sin casilla", async (subscribable) => {
    useCartStore.setState({ lines: [{ ...membershipLine, raw: { subscribable, expiration_days: 30 } }] });
    const client = membershipClient({ listMemberships: async () => [{
      id: membershipLine.id, name: membershipLine.name, can_subscribe: false,
    }] });
    renderPay(client);
    await waitFor(() => expect(lastProps).toBeDefined());
    expect(screen.queryByRole("checkbox", { name: "Pago recurrente" })).toBeNull();
    expect(lastProps?.hasRecurringPayment).toBe(false);
    expect(lastProps?.paymentFrequency).toBeNull();
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
    expect(vi.mocked(client.initialPurchase!).mock.calls[0][0].subscribe).toBe(false);
  });

  it("paquete incluso con subscribable cobra una vez sin casilla", async () => {
    useCartStore.setState({ lines: [{ ...cartLine, raw: { subscribable: true, expiration_days: 30 } }] });
    const client = membershipClient();
    renderPay(client);
    await waitFor(() => expect(lastProps).toBeDefined());
    expect(screen.queryByRole("checkbox", { name: "Pago recurrente" })).toBeNull();
    expect(lastProps?.hasRecurringPayment).toBe(false);
    expect(lastProps?.paymentFrequency).toBeNull();
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
    expect(vi.mocked(client.initialPurchase!).mock.calls[0][0].subscribe).toBe(false);
  });

  it("las opciones van ON y ocultas; GafaPay recibe hasRecurringPayment", async () => {
    renderPay(membershipClient());
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pagar/i })).toBeTruthy();
    });
    await waitFor(() => expect(lastProps?.hasRecurringPayment).toBe(true));
    expect(screen.queryByRole("button", { name: /opciones de la membresía/i })).toBeNull();
    expect(screen.queryByLabelText(/guardar mi tarjeta/i)).toBeNull();
    expect(screen.queryByLabelText(/renovar automáticamente/i)).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Pago recurrente" })).toBeTruthy();
  });

  it("SHOW_MEMBERSHIP_OPTIONS muestra el link y los checks van ON", async () => {
    renderPay(membershipClient(), { showMembershipOptions: true });
    await waitFor(() => expect(lastProps?.hasRecurringPayment).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /opciones de la membresía/i }));
    const save = screen.getByLabelText(/guardar mi tarjeta/i) as HTMLInputElement;
    const renew = screen.getByLabelText(/renovar automáticamente/i) as HTMLInputElement;
    expect(save.checked).toBe(true);
    expect(renew.checked).toBe(true);
    expect(save.className).toContain("gafa-check-input");
  });

  it("al pagar una membresía manda subscribe y set_payment en initial-purchase", async () => {
    const client = membershipClient();
    renderPay(client);
    await waitFor(() => expect((screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement).disabled).toBe(false));
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalled());
    expect(vi.mocked(client.initialPurchase!).mock.calls[0][0]).toEqual(
      expect.objectContaining({ subscribe: true, setPayment: true }),
    );
  });

  it("R1: desmarcar y pagar confirma una vez con subscribe false", async () => {
    const client = membershipClient();
    renderPay(client, { showMembershipOptions: true });
    await waitFor(() => expect((screen.getByRole("button", { name: /pagar/i }) as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByRole("button", { name: /opciones de la membresía/i }));
    fireEvent.click(screen.getByLabelText(/renovar automáticamente/i));

    await waitFor(() =>
      expect(
        vi.mocked(client.initialPurchase!).mock.calls.some((call) => call[0].subscribe === false),
      ).toBe(true),
    );
    await ready();
    const confirm = vi.fn(() => lastProps?.onGafaPaySuccessAction({ message: "single" }));
    window._handleStripePayment = confirm;
    fireEvent.click(pay());
    await screen.findByText(/gracias por tu compra/i);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(client.initialPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ subscribe: false }));
  });

  it("al cambiar recurrencia registra solo el token del nuevo montaje, sin reenviar el anterior", async () => {
    let session = 0;
    mocks.mountGafaPayWidget.mockImplementation((_runtime, _container, _slug, props: GafaPayWidgetProps): GafaPayIsland => {
      const token = `chk_${++session}`;
      queueMicrotask(() => props.onCheckoutOpenAction?.({ message: token, client_secret: `cs_${session}` }));
      return { update: () => undefined, unmount: () => undefined };
    });
    const client = membershipClient();
    renderPay(client);
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("checkbox", { name: "Pago recurrente" }));
    await waitFor(() => expect(client.initialPurchase).toHaveBeenCalledTimes(2));
    expect(vi.mocked(client.initialPurchase!).mock.calls.map(([payload]) => [payload.checkoutToken, payload.subscribe])).toEqual([
      ["chk_1", true],
      ["chk_2", false],
    ]);
  });
});
