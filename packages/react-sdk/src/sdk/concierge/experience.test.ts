import { describe, expect, it } from "vitest";
import {
  actionAllowed,
  catalogGroups,
  filterCatalogProducts,
  openingChips,
  showLocationSwitcher,
} from "./experience";
import { DEMO_CONCIERGE_CONFIG, FITSPIN_CONCIERGE_CONFIG } from "./fixtures";

describe("concierge experience", () => {
  it("usa las etiquetas de cada compañía, no un motor Fitspin", () => {
    expect(openingChips(FITSPIN_CONCIERGE_CONFIG).map((chip) => chip.label)).toEqual([
      "Reservar",
      "Comprar paquetes",
      "Mi cuenta",
      "Horarios de hoy",
    ]);
    expect(openingChips(DEMO_CONCIERGE_CONFIG).map((chip) => chip.label)).toEqual([
      "Book",
      "Buy a pass",
      "Account",
      "Today's classes",
    ]);
    expect(catalogGroups(FITSPIN_CONCIERGE_CONFIG).map((group) => group.label)).toEqual([
      "Clases",
      "Membresías",
    ]);
    expect(catalogGroups(DEMO_CONCIERGE_CONFIG).map((group) => group.label)).toEqual(["Passes"]);
  });

  it("filtra acciones de apertura por capacidades", () => {
    const disabled = {
      ...DEMO_CONCIERGE_CONFIG,
      capabilities: {
        ...DEMO_CONCIERGE_CONFIG.capabilities,
        packages: false,
        account: false,
        schedule: false,
      },
    };
    expect(openingChips(disabled)).toEqual([]);
    expect(actionAllowed(disabled, { kind: "comprar" })).toBe(false);
    expect(actionAllowed(disabled, { kind: "horarios_hoy" })).toBe(false);
  });

  it("infiere grupos desde el catálogo cuando no hay experience", () => {
    const inferred = catalogGroups({ ...DEMO_CONCIERGE_CONFIG, experience: undefined });
    expect(inferred).toEqual([{ id: "combo", label: "Paquetes", match: { types: ["combo"] } }]);
    expect(openingChips({ ...DEMO_CONCIERGE_CONFIG, experience: undefined }).map((chip) => chip.label)).toEqual([
      "Reservar",
      "Comprar paquetes",
      "Mi cuenta",
      "Horarios de hoy",
    ]);
  });

  it("oculta membresías si la compañía no las habilita", () => {
    const withMembership = {
      ...DEMO_CONCIERGE_CONFIG,
      catalog: {
        ...DEMO_CONCIERGE_CONFIG.catalog,
        products: [
          ...DEMO_CONCIERGE_CONFIG.catalog.products,
          {
            type: "membership" as const,
            id: "member",
            brandSlug: "demo",
            locationId: "1",
            name: "Member",
            price: "$50",
            note: "",
          },
        ],
      },
    };
    expect(filterCatalogProducts(withMembership).map((product) => product.id)).toEqual(["demo-combo"]);
    expect(catalogGroups({
      ...withMembership,
      experience: {
        ...withMembership.experience,
        groups: [
          { id: "passes", label: "Passes", match: { types: ["combo"] } },
          { id: "memberships", label: "Memberships", match: { types: ["membership"] } },
        ],
      },
    }).map((group) => group.id)).toEqual(["passes"]);
  });

  it("agrupa y filtra productos del catálogo de la compañía", () => {
    const cancunMemberships = filterCatalogProducts(FITSPIN_CONCIERGE_CONFIG, {
      locationId: "200",
      groupId: "membresias",
    });
    expect(cancunMemberships.every((product) => product.type === "membership")).toBe(true);
    expect(cancunMemberships.every((product) => product.locationId === "200")).toBe(true);
    expect(cancunMemberships.some((product) => product.id === "592")).toBe(true);
    expect(cancunMemberships.some((product) => product.id === "971")).toBe(false);
  });

  it("el switcher de sede sigue la config, no el nombre del socio", () => {
    expect(showLocationSwitcher(FITSPIN_CONCIERGE_CONFIG)).toBe(true);
    expect(showLocationSwitcher(DEMO_CONCIERGE_CONFIG)).toBe(false);
    expect(showLocationSwitcher({
      ...FITSPIN_CONCIERGE_CONFIG,
      experience: { ...FITSPIN_CONCIERGE_CONFIG.experience, locationSwitcher: false },
    })).toBe(false);
  });
});
