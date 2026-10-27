import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../../runtime";
import { useCartStore } from "../../cart/cartStore";
import { createMockGafaClient } from "../../client/gafaClient";
import { installPixelDebugMocks, readPixelDebugLog } from "./debug";
import { resetBrandCurrencyForTests } from "./brandCurrency";
import { resetPixelDedupForTests } from "./eventId";

const PIXEL_CONFIG = {
  apiBaseUrl: "https://example.gafa.fit",
  companyId: 80,
  publicClientId: "demo-client",
  analyticsEnabled: true,
  pixelsEnabled: true,
  pixelsConsentMode: "implied" as const,
  metaPixelId: "111",
  tiktokPixelId: "222",
  ga4MeasurementId: "G-TEST",
};

function clientWithPricedCombo() {
  const base = createMockGafaClient();
  return {
    ...base,
    listCombos: async () => [
      {
        id: 973,
        name: "10 clases",
        price: 330,
        priceFinal: 330,
        priceLabel: "$330",
        currency: "MXN",
        type: "combo" as const,
      },
    ],
  };
}

let sdk: GafaSdk | null = null;

afterEach(async () => {
  sdk?.unmountAll();
  sdk = null;
  useCartStore.setState({ lines: [], reservation: null });
  localStorage.removeItem("gafa-sdk:cart-v1");
  resetPixelDedupForTests();
  resetBrandCurrencyForTests();
  await Promise.resolve();
  document.body.innerHTML = "";
  const w = window as Window & { fbq?: unknown; ttq?: unknown; gtag?: unknown; __BUQ_PIXEL_LOG?: unknown };
  delete w.fbq;
  delete w.ttq;
  delete w.gtag;
  delete w.__BUQ_PIXEL_LOG;
});

describe("Comprar: orden add_to_cart → initiate_checkout", () => {
  it("no abre el checkout vacío; espera el paquete y manda value/currency/items", async () => {
    installPixelDebugMocks();
    sdk = createGafaSdk(PIXEL_CONFIG, { client: clientWithPricedCombo() });
    sdk.openCheckout({ preselect: { type: "combo", id: 973 }, skipCatalog: true });

    await waitFor(() => {
      expect(useCartStore.getState().lines.some((line) => line.id === 973)).toBe(true);
    });
    await waitFor(() => {
      const meta = readPixelDebugLog().filter((row) => row.provider === "meta");
      const add = meta.findIndex((row) => row.args.includes("AddToCart"));
      const checkout = meta.findIndex((row) => row.args.includes("InitiateCheckout"));
      expect(add).toBeGreaterThanOrEqual(0);
      expect(checkout).toBeGreaterThan(add);
    });

    const checkout = readPixelDebugLog().find((row) => row.args.includes("InitiateCheckout"));
    const params = checkout?.args.find((arg) => arg && typeof arg === "object" && "value" in (arg as object)) as
      | { value?: number; currency?: string; content_ids?: string[]; num_items?: number }
      | undefined;
    expect(params).toMatchObject({
      value: 330,
      currency: "MXN",
      content_ids: ["973"],
      num_items: 1,
    });
  });
});
