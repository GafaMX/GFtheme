import { describe, expect, it, vi } from "vitest";
import { DEMO_CONCIERGE_CONFIG, FITSPIN_CONCIERGE_CONFIG } from "./fixtures";
import { hydrateConciergeCatalog, shouldHydrateConcierge } from "./hydrate";
import type { ConciergeHydrateClient } from "./hydrate";

function clientMock(): ConciergeHydrateClient {
  return {
    listLocations: vi.fn(async (brand?: string) => [
      { id: 1, name: "Roma Norte", slug: "roma-norte", brandSlug: brand || "demo-studio" },
      { id: 2, name: "Condesa", slug: "condesa", brandSlug: brand || "demo-studio" },
    ]),
    listCombos: vi.fn(async () => [
      { id: 1, name: "10 clases", description: "Paquete inicial", priceLabel: "$1,200 MXN" },
    ]),
    listMemberships: vi.fn(async () => [
      { id: 2, name: "Mensual ilimitada", description: "Pago recurrente", priceLabel: "$2,400 MXN" },
    ]),
  };
}

describe("hydrateConciergeCatalog", () => {
  it("no hidrata si catalog.live no esta activo", () => {
    expect(shouldHydrateConcierge(DEMO_CONCIERGE_CONFIG)).toBe(false);
    expect(shouldHydrateConcierge({ ...DEMO_CONCIERGE_CONFIG, catalog: { ...DEMO_CONCIERGE_CONFIG.catalog, live: true } })).toBe(true);
    expect(shouldHydrateConcierge(DEMO_CONCIERGE_CONFIG, true)).toBe(true);
    expect(shouldHydrateConcierge({ ...DEMO_CONCIERGE_CONFIG, catalog: { ...DEMO_CONCIERGE_CONFIG.catalog, live: true } }, false)).toBe(false);
  });

  it("si el allowlist no existe en BUQ, usa el catalogo live del cliente", async () => {
    const client = clientMock();
    const next = await hydrateConciergeCatalog({
      ...DEMO_CONCIERGE_CONFIG,
      catalog: { ...DEMO_CONCIERGE_CONFIG.catalog, live: true },
    }, client);
    expect(next.catalog.products.map((product) => `${product.type}:${product.id}`)).toEqual(["combo:1"]);
    expect(next.catalog.products[0]?.name).toBe("10 clases");
    expect(client.listMemberships).not.toHaveBeenCalled();
  });

  it("respeta el allowlist cuando los IDs si existen en BUQ", async () => {
    const client = clientMock();
    const next = await hydrateConciergeCatalog({
      ...FITSPIN_CONCIERGE_CONFIG,
      capabilities: { ...FITSPIN_CONCIERGE_CONFIG.capabilities, memberships: true },
      catalog: {
        version: "allow",
        live: true,
        products: [{
          type: "combo",
          id: "1",
          brandSlug: "fitspin",
          locationId: "122",
          name: "1 CLASE",
          price: "$330",
          note: "",
        }],
      },
    }, client);
    expect(next.catalog.products).toEqual([
      expect.objectContaining({ type: "combo", id: "1", brandSlug: "fitspin", name: "10 clases" }),
    ]);
  });

  it("no duplica el mismo combo si varias marcas ven el mismo catalogo live", async () => {
    const client = clientMock();
    const next = await hydrateConciergeCatalog({
      ...FITSPIN_CONCIERGE_CONFIG,
      catalog: { ...FITSPIN_CONCIERGE_CONFIG.catalog, live: true },
    }, client);
    expect(next.catalog.products.map((product) => `${product.type}:${product.id}`)).toEqual([
      "combo:1",
      "membership:2",
    ]);
  });

  it("no mezcla marcas: solo pide sedes/catalogo de las marcas del socio", async () => {
    const client = clientMock();
    await hydrateConciergeCatalog({
      ...DEMO_CONCIERGE_CONFIG,
      catalog: { ...DEMO_CONCIERGE_CONFIG.catalog, live: true },
    }, client);
    expect(client.listLocations).toHaveBeenCalledWith("demo");
    expect(client.listLocations).not.toHaveBeenCalledWith("fitspin");
    expect(client.listCombos).toHaveBeenCalledWith("demo");
  });
});
