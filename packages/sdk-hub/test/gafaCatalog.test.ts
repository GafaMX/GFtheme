import { describe, expect, it } from "vitest";
import { fetchGafaCatalog, gafaApiBaseUrl, preferredBrandId } from "../src/gafaCatalog";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function page(data: unknown[], current = 1, last = 1) {
  return { data, current_page: current, last_page: last };
}

describe("gafaApiBaseUrl", () => {
  it("usa production si no hay nada", () => {
    expect(gafaApiBaseUrl({})).toBe("https://buq.partners");
    expect(gafaApiBaseUrl(null)).toBe("https://buq.partners");
  });

  it("respeta GAFA_FIT_URL y BUQ_ENV", () => {
    expect(gafaApiBaseUrl({ GAFA_FIT_URL: "https://api.example.test/" })).toBe("https://api.example.test");
    expect(gafaApiBaseUrl({ BUQ_ENV: "staging" })).toBe("https://buq.com.mx");
    expect(gafaApiBaseUrl({ BUQ_ENV: "development" })).toBe("https://buq.technology");
  });

  it("lee BRAND_ID solo si es un número útil", () => {
    expect(preferredBrandId({ BRAND_ID: 86 })).toBe(86);
    expect(preferredBrandId({ BRAND_ID: 0 })).toBeNull();
    expect(preferredBrandId({})).toBeNull();
  });
});

describe("fetchGafaCatalog", () => {
  it("junta paquetes y membresías, oculta hide_in_front y tolera productos 404", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      const path = url.pathname;
      if (path === "/api/brand") {
        return json(
          page([
            { id: 86, name: "Fitspin Cdmx", slug: "fitspin", status: "active" },
            { id: 9, name: "Muerta", slug: "dead", status: "inactive" },
          ]),
        );
      }
      if (path === "/api/brand/fitspin/combos") {
        return json(
          page([
            { id: 971, name: "1 clase", price: 330, price_final: 330, hide_in_front: 0 },
            { id: 1644, name: "CORTESIA", price: 0, hide_in_front: 1 },
          ]),
        );
      }
      if (path === "/api/brand/fitspin/membership") {
        return json(page([{ id: 670, name: "Membresía pm", price_final: 1699 }]));
      }
      if (path === "/api/brand/fitspin/product" || path === "/api/brand/fitspin/products") {
        return json({ message: "not found" }, 404);
      }
      return json({ message: path }, 500);
    };

    const catalog = await fetchGafaCatalog({
      companyId: 80,
      apiBaseUrl: "https://buq.partners",
      fetchImpl,
    });

    expect(catalog.brands.map((brand) => brand.slug)).toEqual(["fitspin"]);
    expect(catalog.items.map((item) => `${item.type}:${item.id}:${item.name}`)).toEqual([
      "combo:971:1 clase",
      "membership:670:Membresía pm",
    ]);
    expect(catalog.items[0]?.priceLabel).toBe("$330");
    expect(catalog.warnings.some((line) => /productos de tienda/i.test(line))).toBe(true);
  });

  it("pagina el catálogo y manda GAFAFIT-COMPANY", async () => {
    const companies: string[] = [];
    const combosPages: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      companies.push(String((init?.headers as Record<string, string>)["GAFAFIT-COMPANY"]));
      if (url.pathname === "/api/brand") {
        return json(page([{ id: 1, name: "Marca", slug: "marca", status: "active" }]));
      }
      if (url.pathname === "/api/brand/marca/combos") {
        combosPages.push(url.searchParams.get("page") ?? "");
        const pageNo = Number(url.searchParams.get("page") ?? 1);
        return json(page([{ id: pageNo, name: `P${pageNo}`, price: 10 }], pageNo, 2));
      }
      if (url.pathname === "/api/brand/marca/membership") return json(page([]));
      if (url.pathname.startsWith("/api/brand/marca/product")) return json({}, 404);
      return json({}, 500);
    };

    const catalog = await fetchGafaCatalog({
      companyId: 80,
      apiBaseUrl: "https://buq.partners/",
      fetchImpl,
    });
    expect(combosPages).toEqual(["1", "2"]);
    expect(catalog.items.map((item) => item.name)).toEqual(["P1", "P2"]);
    expect(new Set(companies)).toEqual(new Set(["80"]));
  });

  it("si hay BRAND_ID solo trae esa marca", async () => {
    const slugs: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/brand") {
        return json(
          page([
            { id: 86, name: "CDMX", slug: "fitspin", status: "active" },
            { id: 125, name: "Cancún", slug: "fitspin-cancun", status: "active" },
          ]),
        );
      }
      const match = url.pathname.match(/^\/api\/brand\/([^/]+)\//);
      if (match) slugs.push(match[1] ?? "");
      if (url.pathname.endsWith("/combos") || url.pathname.endsWith("/membership")) return json(page([]));
      return json({}, 404);
    };

    await fetchGafaCatalog({
      companyId: 80,
      apiBaseUrl: "https://buq.partners",
      brandId: 125,
      fetchImpl,
    });
    expect(new Set(slugs)).toEqual(new Set(["fitspin-cancun"]));
  });
});
