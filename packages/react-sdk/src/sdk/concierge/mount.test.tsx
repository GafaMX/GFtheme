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
  it("fija la barra al viewport y abre el chat encima, como Fitspin", async () => {
    const handle = boot().concierge.mount({ config: DEMO_CONCIERGE_CONFIG });
    const bar = await waitFor(() => {
      const node = document.querySelector<HTMLElement>("[data-gafa-concierge-bar]");
      expect(node).toBeTruthy();
      return node!;
    });
    expect(bar.className).toContain("gafa-concierge-bar");
    const inner = bar.querySelector<HTMLElement>(".gafa-concierge-bar-inner");
    const cta = bar.querySelector<HTMLElement>("[data-gafa-concierge-cta]");
    expect(inner).toBeTruthy();
    expect(cta?.className).toContain("gafa-concierge-bar-cta");
    expect(cta?.textContent).toMatch(/Concierge/i);
    expect(document.body.textContent).toMatch(/Reservar/i);
    expect(document.body.textContent).toMatch(/Comprar/i);

    handle.open();
    await waitFor(() => {
      const dialog = document.querySelector<HTMLElement>("[data-gafa-concierge-dialog]");
      expect(dialog).toBeTruthy();
      expect(dialog?.className).toContain("gafa-concierge-dialog");
    });
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.trim() === "Cerrar")).toBe(true);
    handle.close();
  });

  it("personaliza el saludo sin pegar el nombre al final", async () => {
    const handle = boot().concierge.mount({ config: FITSPIN_CONCIERGE_CONFIG });
    handle.open();
    await waitFor(() => {
      expect(document.body.textContent).toContain("¡Hola, Demo! 👋 Soy el concierge de FITSPIN.");
    });
    expect(document.body.textContent).not.toMatch(/FITSPIN\., Demo/);
    handle.close();
  });

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
      expect(document.body.textContent).toContain("Book");
      expect(document.body.textContent).toContain("Buy a pass");
      expect(document.body.textContent).toContain("Today's classes");
    });

    handle.close();
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"][aria-modal="true"]')).toBeNull();
    });

    handle.destroy();
    expect(document.querySelector("[data-gafa-concierge='demo-studio']")).toBeNull();
  });

  it("pinta pastillas con icono e input propio; el scheme sale de CONCIERGE, no del THEME", async () => {
    sdk = createGafaSdk(
      { ...CONFIG, companyId: 8801, theme: { colorScheme: "dark", allowUserColorScheme: false } },
      { useMockClient: true },
    );
    const handle = sdk.concierge.mount({ config: FITSPIN_CONCIERGE_CONFIG });
    handle.open();
    const dialog = await waitFor(() => {
      const node = document.querySelector<HTMLElement>("[data-gafa-concierge-dialog]");
      expect(node).toBeTruthy();
      return node!;
    });
    expect(dialog.getAttribute("data-color-scheme")).toBe("light");
    expect(dialog.style.getPropertyValue("--concierge-field-bg")).toBe("#ffffff");
    expect(dialog.querySelectorAll(".gafa-concierge-chip").length).toBeGreaterThan(0);
    expect(dialog.querySelector(".gafa-concierge-chip svg")).toBeTruthy();
    expect(dialog.querySelector(".gafa-concierge-input")).toBeTruthy();
    const toggle = dialog.querySelector<HTMLButtonElement>(".gafa-concierge-scheme-toggle");
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle!);
    expect(dialog.getAttribute("data-color-scheme")).toBe("dark");
    expect(dialog.style.getPropertyValue("--concierge-field-bg")).toBe("#2a2a2a");
    handle.destroy();
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
      expect(document.body.textContent).toContain("Available passes:");
      expect(document.querySelector("[data-gafa-concierge-catalog]")).toBeTruthy();
      expect(document.body.textContent).toContain("Drop-in");
    });
    const buy = Array.from(document.querySelectorAll("[data-gafa-concierge-catalog] button")).find((button) => button.textContent?.includes("Comprar"));
    buy?.click();
    await waitFor(() => {
      expect(document.querySelector(".gafa-checkout-overlay")).toBeTruthy();
      expect(document.querySelector("[data-gafa-concierge-dialog]")).toBeNull();
    });
  });

  it("abre el catálogo en el chat desde Comprar y no navega", async () => {
    const navigated: string[] = [];
    const handle = boot().concierge.mount({
      config: DEMO_CONCIERGE_CONFIG,
      navigate: (path) => navigated.push(path),
    });
    const buy = await waitFor(() => {
      const button = Array.from(document.querySelectorAll("[data-gafa-concierge-bar] button"))
        .find((candidate) => candidate.textContent?.trim() === "Comprar");
      expect(button).toBeTruthy();
      return button!;
    });
    fireEvent.click(buy);
    await waitFor(() => {
      expect(document.querySelector("[data-gafa-concierge-catalog]")).toBeTruthy();
      expect(document.body.textContent).toContain("Available passes:");
      expect(document.body.textContent).toContain("Drop-in");
    });
    expect(navigated).toEqual([]);
    handle.close();
  });

  it("muestra chips de apertura y filtros de sede/categoría desde experience", async () => {
    const handle = boot().concierge.mount({ config: FITSPIN_CONCIERGE_CONFIG });
    handle.open();
    await waitFor(() => {
      expect(document.body.textContent).toContain("Comprar paquetes");
      expect(document.body.textContent).toContain("Horarios de hoy");
    });
    const chip = Array.from(document.querySelectorAll("[data-gafa-concierge-dialog] button"))
      .find((button) => button.textContent?.trim() === "Comprar paquetes");
    fireEvent.click(chip!);
    await waitFor(() => {
      expect(document.querySelector("[data-gafa-concierge-catalog]")).toBeTruthy();
      expect(document.body.textContent).toContain("Todas las sedes");
      expect(document.querySelector('[data-gafa-concierge-location="122"]')?.textContent).toContain("LOMAS");
      expect(document.querySelector('[data-gafa-concierge-group="clases"]')?.textContent).toContain("Clases");
      expect(document.querySelector('[data-gafa-concierge-group="membresias"]')?.textContent).toContain("Membresías");
    });
    fireEvent.click(document.querySelector('[data-gafa-concierge-location="200"]')!);
    fireEvent.click(document.querySelector('[data-gafa-concierge-group="membresias"]')!);
    await waitFor(() => {
      expect(document.body.textContent).toContain("MEMBRESÍA CANCÚN");
      expect(document.body.textContent).not.toContain("1 CLASE");
    });
    handle.close();
  });

  it("no cierra el concierge si el checkout no abre", async () => {
    const handle = boot().concierge.mount({
      config: {
        ...DEMO_CONCIERGE_CONFIG,
        catalog: {
          ...DEMO_CONCIERGE_CONFIG.catalog,
          products: [{
            type: "combo",
            id: "not-a-number",
            brandSlug: "demo",
            locationId: "1",
            name: "Broken pass",
            price: "$20",
            note: "Valid for 30 days",
          }],
        },
      },
    });
    handle.open();
    await waitFor(() => {
      expect(document.body.textContent).toContain("Buy a pass");
    });
    fireEvent.click(Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Buy a pass")!);
    await waitFor(() => {
      expect(document.body.textContent).toContain("Broken pass");
    });
    fireEvent.click(Array.from(document.querySelectorAll("[data-gafa-concierge-catalog] button")).find((button) => button.textContent?.includes("Comprar"))!);
    await waitFor(() => {
      expect(document.body.textContent).toContain("El checkout no se abrió");
    }, { timeout: 4_000 });
    expect(document.querySelector(".gafa-checkout-overlay")).toBeNull();
    expect(document.querySelector("[data-gafa-concierge-dialog]")).toBeTruthy();
    handle.close();
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
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Buy a pass"))).toBe(false);
    expect(Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Account"))).toBe(false);
  });

  it("sin teléfono no pinta el botón de WhatsApp y el resto sí monta", async () => {
    boot().concierge.mount({
      config: { ...DEMO_CONCIERGE_CONFIG, contact: {} },
    });
    await waitFor(() => {
      expect(document.querySelector("[data-gafa-concierge-bar]")).toBeTruthy();
    });
    expect(document.querySelector('[aria-label="WhatsApp"]')).toBeNull();
    expect(document.querySelector("[data-gafa-concierge-cta]")).toBeTruthy();
  });
});
