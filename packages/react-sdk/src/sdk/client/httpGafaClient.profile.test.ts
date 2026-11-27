import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { clearStoredToken, writeStoredToken } from "./tokenStorage";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function client() {
  return createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 225 });
}

describe("getProfile turnstile_card_no", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredToken();
  });

  it("lee turnstile_card_no de GET /api/me sin calcularlo", async () => {
    writeStoredToken("token-de-prueba");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/me") && !url.includes("store-credit")) {
        return jsonResponse({
          id: 12,
          email: "socio@thebase.mx",
          first_name: "Ana",
          last_name: "Ruiz",
          store_credit_total: "0",
          turnstile_card_no: "1234567",
        });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const profile = await client().getProfile();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://buq.partners/api/me");
    expect(profile?.turnstileCardNo).toBe("1234567");
  });

  it("deja el campo ausente cuando /me no lo manda", async () => {
    writeStoredToken("token-de-prueba");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          id: 12,
          email: "ana@fitspin.mx",
          first_name: "Ana",
          store_credit_total: "0",
        }),
      ),
    );

    const profile = await client().getProfile();
    expect(profile?.turnstileCardNo).toBeUndefined();
  });

  it("respeta null: no inventa un número", async () => {
    writeStoredToken("token-de-prueba");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          id: 12,
          email: "ana@fitspin.mx",
          first_name: "Ana",
          store_credit_total: "0",
          turnstile_card_no: null,
        }),
      ),
    );

    const profile = await client().getProfile();
    expect(profile?.turnstileCardNo).toBeNull();
  });
});
