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

  async function purchaseWith(paymentData: Record<string, unknown>) {
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

  it("manda las líneas como arrays PHP", async () => {
    const body = await purchaseWith({ token: "tok_simple" });

    expect(body.get("combos_id[0]")).toBe("971");
    expect(body.get("combos_amounts[0]")).toBe("1");
    expect(body.get("checkout_token")).toBe("chk_1");
  });
});
