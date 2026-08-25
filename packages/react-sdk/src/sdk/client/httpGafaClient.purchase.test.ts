import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function client() {
  return createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 1 });
}

describe("initialPurchase", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function purchaseWith(paymentData: unknown) {
    const fetchMock = vi.fn(async () => jsonResponse({ purchase_id: 88, checkout_token: "chk_1" }));
    vi.stubGlobal("fetch", fetchMock);

    await client().initialPurchase?.({
      brandSlug: "fitspin",
      locationSlug: "polanco",
      userId: 4412,
      lines: [{ id: 971, type: "combo", amount: 1 }],
      paymentTypeId: 3,
      paymentData,
      checkoutToken: "chk_1",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return new URLSearchParams(String(init.body));
  }

  it("manda payment_data anidado como array PHP: con JSON gafa.fit deja 'Checkout no resuelto'", async () => {
    const body = await purchaseWith({
      stripeToken: "tok_visa",
      card: { id: "card_1", brand: "visa" },
    });

    expect(body.get("payment_data[stripeToken]")).toBe("tok_visa");
    expect(body.get("payment_data[card][id]")).toBe("card_1");
    expect(body.get("payment_data[card][brand]")).toBe("visa");
    expect(body.get("payment_data[card]")).toBeNull();
  });

  it("mantiene los escalares de payment_data tal cual", async () => {
    const body = await purchaseWith({ token: "tok_simple" });

    expect(body.get("payment_data[token]")).toBe("tok_simple");
  });

  it("si GafaPay contesta con texto, va plano como en el fancy v1", async () => {
    const body = await purchaseWith("Se completó el pago.");

    expect(body.get("payment_data")).toBe("Se completó el pago.");
    expect(body.get("payment_data[token]")).toBeNull();
  });

  it("manda las líneas como arrays PHP", async () => {
    const body = await purchaseWith({ token: "tok_simple" });

    expect(body.get("combos_id[0]")).toBe("971");
    expect(body.get("combos_amounts[0]")).toBe("1");
    expect(body.get("checkout_token")).toBe("chk_1");
  });

  /* jQuery ($.param) manda `clave=` vacía cuando el valor es null; si la
     clave falta, Laravel convierte "Undefined array key" en excepción y el
     500 llega con el cargo ya hecho. */
  it("manda TODAS las claves del fancy v1, vacías si no aplican", async () => {
    const body = await purchaseWith("NDk0…recibo");

    expect(body.get("payment_data")).toBe("NDk0…recibo");
    expect(body.get("_token")).toBe("");
    expect(body.get("meeting_data")).toBe("");
    expect(body.get("invited_data")).toBe("");
    expect(body.get("signature")).toBe("");
    expect(body.get("subscriptionId")).toBe("");
    expect(body.get("selected_credit")).toBe("");
    expect(body.get("discountCode")).toBe("");
    expect(body.get("giftCode")).toBe("");
    // Booleanos como los serializa jQuery en v1.
    expect(body.get("subscribe")).toBe("false");
    expect(body.get("set_payment")).toBe("false");
    expect(body.get("test")).toBe("false");
    // Sin meeting: la clave viaja vacía, no ausente.
    expect(body.get("meetings_id")).toBe("");
  });

  it("manda cart/combo con product_type Eloquent, como el fancy v1", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ purchase_id: 88 }));
    vi.stubGlobal("fetch", fetchMock);

    await client().initialPurchase?.({
      brandSlug: "fitspin",
      locationSlug: "polanco",
      userId: 4412,
      lines: [{ id: 971, type: "combo", amount: 1, name: "1 clase", price: 330, companiesId: 80 }],
      paymentTypeId: 6,
      paymentData: { id: "ch_123" },
      discountCode: "buqmx",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));

    expect(body.get("discountCode")).toBe("buqmx");
    expect(body.get("cart[0][id]")).toBe("971");
    expect(body.get("cart[0][type]")).toBe("combo");
    expect(body.get("cart[0][amount]")).toBe("1");
    expect(body.get("cart[0][name]")).toBe("1 clase");
    expect(body.get("cart[0][price_final]")).toBe("330");
    expect(body.get("cart[0][product_type]")).toBe("App\\Models\\Combos\\Combos");
    expect(body.get("cart[0][companies_id]")).toBe("80");
    expect(body.get("combo[0][id]")).toBe("971");
    expect(body.get("combo[0][product_type]")).toBe("App\\Models\\Combos\\Combos");
    expect(body.get("memberships_id[0]")).toBeNull();
  });

  it("manda giftCode al convertir la compra en GiftCard", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ purchase_id: 88 }));
    vi.stubGlobal("fetch", fetchMock);

    await client().initialPurchase?.({
      brandSlug: "fitspin",
      locationSlug: "polanco",
      userId: 4412,
      lines: [{ id: 971, type: "combo", amount: 1 }],
      paymentTypeId: 6,
      paymentData: { id: "ch_123" },
      giftCode: "K7M2P9QX",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(body.get("giftCode")).toBe("K7M2P9QX");
  });
});

describe("reservatePurchase", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTea a /reservate, no a initial-purchase", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ purchase: { id: 88 } }));
    vi.stubGlobal("fetch", fetchMock);

    await client().reservatePurchase?.({
      brandSlug: "fitspin",
      locationSlug: "fitspin-polanco",
      userId: 370466,
      lines: [{ id: 971, type: "combo", amount: 1 }],
      paymentTypeId: 6,
      paymentData: "NDk0MTE4X3x8X2NoXzNVNXJZ",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://buq.partners/api/brand/fitspin/location/fitspin-polanco/reservation/reservate",
    );
    expect(url).not.toContain("initial-purchase");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("payment_data")).toBe("NDk0MTE4X3x8X2NoXzNVNXJZ");
    expect(body.get("users_id")).toBe("370466");
    expect(body.get("payment_types_id")).toBe("6");
  });

  it("lee purchase.id y reservation[0].id como el fancy v1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          purchase: { id: 494780 },
          reservation: [{ id: 9001, meeting_position: 12 }],
        }),
      ),
    );

    const result = await client().reservatePurchase?.({
      brandSlug: "fitspin",
      locationSlug: "fitspin-polanco",
      userId: 370466,
      meetingId: 849768,
      lines: [{ id: 971, type: "combo", amount: 1 }],
      paymentTypeId: 6,
      paymentData: "recibo",
    });

    expect(result?.purchaseId).toBe(494780);
    expect(result?.reservationId).toBe(9001);
  });

  it("marca isWaitlist cuando reservate mete la clase a la lista", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          purchase: { id: 10 },
          reservation: [{ id: 22, is_waitlist: true }],
        }),
      ),
    );

    const result = await client().reservatePurchase?.({
      brandSlug: "fitspin",
      locationSlug: "fitspin-polanco",
      userId: 370466,
      meetingId: 849768,
      lines: [{ id: 971, type: "combo", amount: 1 }],
      paymentTypeId: 6,
      paymentData: "recibo",
    });

    expect(result?.isWaitlist).toBe(true);
    expect(result?.reservationId).toBe(22);
  });

  it("falla si Buq responde 200 sin compra ni reserva", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));

    await expect(
      client().reservatePurchase?.({
        brandSlug: "fitspin",
        locationSlug: "fitspin-polanco",
        userId: 370466,
        lines: [{ id: 971, type: "combo", amount: 1 }],
        paymentTypeId: 6,
        paymentData: "recibo",
      }),
    ).rejects.toThrow(/no confirmó la compra/i);
  });
});

describe("pollInitialPurchaseStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function poll(payload: Record<string, unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(payload)),
    );
    return client().pollInitialPurchaseStatus?.({
      brandSlug: "fitspin",
      locationSlug: "fitspin-polanco",
      checkoutToken: "chk_1",
      pendingPurchaseId: 88,
    });
  }

  it("lee el detalle del fallo de `error`, que es como responde gafa.fit", async () => {
    const status = await poll({ code: -1, error: "Hubo un error en la creación del pago" });

    expect(status?.code).toBe(-1);
    expect(status?.message).toBe("Hubo un error en la creación del pago");
  });

  it("devuelve la reserva cuando ya resolvió", async () => {
    const status = await poll({ code: 1, reservation_id: 77 });

    expect(status?.code).toBe(1);
    expect(status?.reservationId).toBe(77);
  });
});
