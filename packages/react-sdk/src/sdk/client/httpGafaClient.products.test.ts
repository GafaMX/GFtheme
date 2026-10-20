import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { clearStoredToken, writeStoredToken } from "./tokenStorage";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function client() {
  return createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
}

describe("listProducts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa /product cuando responde 200", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/brand/fitspin/product")) {
        return jsonResponse({
          data: [{ id: 9, name: "Agua", price: 40, price_final: 40, hide_in_front: 0 }],
        });
      }
      return jsonResponse({ message: "" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const products = await client().listProducts?.("fitspin");
    expect(products).toEqual([
      expect.objectContaining({ id: 9, name: "Agua", type: "product" }),
    ]);
  });

  it("si /product no existe prueba /products", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/brand/fitspin/products")) {
        return jsonResponse({
          data: [{ id: 12, name: "Toalla", price: 150, price_final: 150 }],
        });
      }
      return jsonResponse({ message: "" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const products = await client().listProducts?.("fitspin");
    expect(products?.[0]?.name).toBe("Toalla");
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/brand/fitspin/product"),
        expect.stringContaining("/brand/fitspin/products"),
      ]),
    );
  });

  it("si ninguna ruta es pública devuelve [] y no tira", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "" }, 404)),
    );
    await expect(client().listProducts?.("fitspin")).resolves.toEqual([]);
  });
});

describe("getCheckoutConfig store tab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredToken();
  });

  it("pide default_store_tab=products cuando no hay clase anclada", async () => {
    writeStoredToken("tok-test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/brand") || url.includes("/api/brand?")) {
        return jsonResponse({ data: [{ id: 1, name: "Fitspin", slug: "fitspin" }] });
      }
      if (url.includes("/api/me")) {
        return jsonResponse({ id: 4412, name: "Ana", email: "ana@fitspin.mx" });
      }
      if (url.includes("create-form-template")) {
        return new Response(
          `<div class="CreateReservationFancy--urlReservation">/reservate</div>
           <div class="CreateReservationFancy--productsSelection">[{"id":9,"name":"Agua","price":40,"price_final":40}]</div>
           <div class="CreateReservationFancy--payment_types">[]</div>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const config = await client().getCheckoutConfig?.({
      brandSlug: "fitspin",
      locationSlug: "fitspin-lomas",
    });

    const formUrl = fetchMock.mock.calls
      .map(([url]) => String(url))
      .find((url) => url.includes("create-form-template"));
    expect(formUrl).toContain("default_store_tab=products");
    expect(formUrl).not.toContain("meetings_id=");
    expect(config?.products).toEqual([expect.objectContaining({ id: 9, name: "Agua", type: "product" })]);
  });

  it("con clase no manda default_store_tab", async () => {
    writeStoredToken("tok-test");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/brand") || url.includes("/api/brand?")) {
        return jsonResponse({ data: [{ id: 1, name: "Fitspin", slug: "fitspin" }] });
      }
      if (url.includes("/api/me")) {
        return jsonResponse({ id: 4412, name: "Ana", email: "ana@fitspin.mx" });
      }
      if (url.includes("create-form-template")) {
        return new Response(
          `<div class="CreateReservationFancy--urlReservation">/reservate</div>
           <div class="CreateReservationFancy--payment_types">[]</div>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        );
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await client().getCheckoutConfig?.({
      brandSlug: "fitspin",
      locationSlug: "fitspin-lomas",
      meetingId: 99,
    });

    const formUrl = fetchMock.mock.calls
      .map(([url]) => String(url))
      .find((url) => url.includes("create-form-template"));
    expect(formUrl).toContain("meetings_id=99");
    expect(formUrl).not.toContain("default_store_tab=");
  });
});
