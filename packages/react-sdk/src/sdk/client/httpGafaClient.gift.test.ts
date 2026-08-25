import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function client() {
  return createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 1 });
}

describe("checkGiftCode / generateGiftCode", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET check-gift-code con el template del fancy", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: "Gift card not found" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const result = await client().checkGiftCode?.({
      brandSlug: "fitspin",
      locationSlug: "helipuerto",
      code: "ab12-cd34",
      urlTemplate:
        "https://buq.partners/api/brand/fitspin/location/helipuerto/reservation/check-gift-code/_|_",
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://buq.partners/api/brand/fitspin/location/helipuerto/reservation/check-gift-code/AB12CD34",
    );
    expect(result?.valid).toBe(false);
    expect(result?.httpStatus).toBe(404);
  });

  it("200 con gift existente marca el código como ocupado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ id: 12, code: "EXISTE", balance: 500, name: "5 clases" })),
    );

    const result = await client().checkGiftCode?.({
      brandSlug: "fitspin",
      locationSlug: "polanco",
      code: "EXISTE",
    });

    expect(result?.valid).toBe(true);
    expect(result?.balance).toBe(500);
  });

  it("GET generate-code y lee el code", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ code: "k7m2-p9qx" }));
    vi.stubGlobal("fetch", fetchMock);

    const code = await client().generateGiftCode?.({
      brandSlug: "fitspin",
      locationSlug: "polanco",
      urlTemplate:
        "https://buq.partners/api/brand/fitspin/location/polanco/reservation/generate-code",
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://buq.partners/api/brand/fitspin/location/polanco/reservation/generate-code",
    );
    expect(code).toBe("K7M2P9QX");
  });
});
