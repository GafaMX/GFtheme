import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { DEMO_CONCIERGE_CONFIG, FITSPIN_CONCIERGE_CONFIG } from "./fixtures";
import { resolveConciergeConfig } from "./mount";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 1, publicClientId: "demo-client" };

let sdk: GafaSdk | null = null;

function boot(): GafaSdk {
  sdk = createGafaSdk(CONFIG, { useMockClient: true });
  return sdk;
}

afterEach(() => {
  sdk?.unmountAll();
  sdk = null;
  document.body.innerHTML = "";
});

describe("sdk.concierge.mount", () => {
  it("abre, cierra y destruye el widget sin mezclar partners", async () => {
    const handle = boot().concierge.mount({ config: DEMO_CONCIERGE_CONFIG });
    expect(document.querySelector("[data-gafa-concierge='demo-studio']")).toBeTruthy();
    expect(document.querySelector("[data-gf-theme='fancy']")).toBeTruthy();
    await waitFor(() => {
      expect(document.querySelector('[aria-label="WhatsApp"]')).toBeTruthy();
    });

    handle.open();
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"][aria-modal="true"]')).toBeTruthy();
      expect(document.getElementById("concierge-title-demo-studio")?.textContent).toBe("Studio guide");
    });

    handle.close();
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
    });

    handle.destroy();
    expect(document.querySelector("[data-gafa-concierge='demo-studio']")).toBeNull();
  });

  it("rechaza un partnerId que no coincide con la config", () => {
    expect(() =>
      resolveConciergeConfig({
        partnerId: "fitspin",
        config: DEMO_CONCIERGE_CONFIG,
      }),
    ).toThrow(/does not match/);
  });

  it("no usa el catalogo Fitspin como default del SDK", () => {
    const handle = boot().concierge.mount({ config: DEMO_CONCIERGE_CONFIG });
    handle.open();
    expect(document.body.textContent).not.toContain(FITSPIN_CONCIERGE_CONFIG.copy.title);
    expect(DEMO_CONCIERGE_CONFIG.catalog.products.some((product) => product.id === "971")).toBe(false);
  });

  it("muestra paquetes allowlisted y entrega el checkout nativo", async () => {
    const handle = boot().concierge.mount({
      config: {
        ...DEMO_CONCIERGE_CONFIG,
        catalog: {
          ...DEMO_CONCIERGE_CONFIG.catalog,
          products: [{
            type: "combo",
            id: "1",
            brandSlug: "demo",
            locationId: "1",
            name: "Drop-in",
            price: "$20",
            note: "Valid for 30 days",
          }],
        },
      },
    });
    handle.open();
    await waitFor(() => {
      expect(document.querySelector("#concierge-input-demo-studio")).toBeTruthy();
    });
    const input = document.querySelector<HTMLInputElement>("#concierge-input-demo-studio");
    const form = input?.closest("form");
    expect(input && form).toBeTruthy();
    fireEvent.change(input!, { target: { value: "quiero un paquete" } });
    fireEvent.submit(form!);
    await waitFor(() => {
      expect(document.body.textContent).toContain("Estos son los paquetes disponibles:");
      expect(document.body.textContent).toContain("Drop-in");
    });
    const buy = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("Comprar"));
    buy?.click();
    await waitFor(() => {
      expect(document.querySelector(".gafa-checkout-overlay")).toBeTruthy();
    });
  });

  it("oculta chips de cuenta/paquetes cuando el fallback o capability estan apagados", async () => {
    const handle = boot().concierge.mount({
      config: {
        ...DEMO_CONCIERGE_CONFIG,
        capabilities: {
          ...DEMO_CONCIERGE_CONFIG.capabilities,
          packages: false,
          account: false,
          whatsapp: false,
        },
      },
    });
    handle.open();
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    });
    expect(document.querySelector('[aria-label="WhatsApp"]')).toBeNull();
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Paquetes"))).toBe(false);
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Mi cuenta"))).toBe(false);
  });
});
