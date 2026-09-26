import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckoutModal } from "../widgets/CheckoutModal";
import { AccountModal } from "../widgets/AccountModal";
import { SdkBodyOverlay } from "../widgets/SdkBodyOverlay";
import { useCartStore, type CartLine } from "../cart/cartStore";
import type { GafaClient } from "../client/types";
import {
  ThemeProvider,
  themePreferenceStorageKey,
  themeToCssVariables,
} from "./theme";

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  document.body.removeAttribute("data-theme");
  localStorage.clear();
  useCartStore.setState({ lines: [], reservation: null });
});

const cartLine: CartLine = {
  key: "atlic:combo:1",
  id: 1,
  type: "combo",
  name: "Pack",
  price: 100,
  priceLabel: "$100",
  amount: 1,
  brandSlug: "atlic",
};

function mockClient(): GafaClient {
  return {
    listBrands: async () => [{ id: 1, name: "ATLIC", slug: "atlic" }],
    listLocations: async () => [{ id: 2, name: "CDMX", slug: "cdmx", brandSlug: "atlic" }],
    listCombos: async () => [],
    listMemberships: async () => [],
    listRegistrationFields: async () => [],
    getProfile: async () => {
      throw new Error("Sin sesión");
    },
  } as unknown as GafaClient;
}

function wrap(ui: ReactNode, theme: { colorScheme: "light" | "dark"; allowUserColorScheme?: boolean }, scope?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme} storageScope={scope}>
        {ui}
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("THEME locked no lo pisa el host ni el storage", () => {
  it("dark locked: overlay nace dark con variables propias, aunque el host y el storage digan light", () => {
    document.body.setAttribute("data-theme", "light");
    localStorage.setItem("fitspin-theme", "light");
    localStorage.setItem("gafa-sdk-color-scheme", "light");
    localStorage.setItem(themePreferenceStorageKey("171:203"), "light");

    wrap(
      <SdkBodyOverlay className="gafa-checkout-overlay">pago</SdkBodyOverlay>,
      { colorScheme: "dark", allowUserColorScheme: false },
      "171:203",
    );

    const overlay = document.body.querySelector(".gafa-checkout-overlay");
    expect(overlay?.getAttribute("data-color-scheme")).toBe("dark");
    const style = overlay?.getAttribute("style") ?? "";
    expect(style).toMatch(/--gafa-color-text:/);
    expect(style).toMatch(/--gafa-color-surface:/);
    expect(style).not.toMatch(/var\(--sdk-text-color/);
    expect(style).toMatch(/--gafa-logo-max-height:\s*64px/);
    expect(style).toMatch(/--gafa-logo-max-width:\s*180px/);
  });

  it("light locked: ignora preferencia dark guardada", () => {
    localStorage.setItem(themePreferenceStorageKey("9:a"), "dark");
    document.documentElement.className = "fitspin-dark";

    wrap(
      <SdkBodyOverlay className="gafa-account-overlay">cuenta</SdkBodyOverlay>,
      { colorScheme: "light", allowUserColorScheme: false },
      "9:a",
    );

    expect(document.body.querySelector(".gafa-account-overlay")?.getAttribute("data-color-scheme")).toBe(
      "light",
    );
  });

  it("cuenta y checkout locked dark salen iguales", () => {
    useCartStore.setState({ lines: [cartLine], reservation: null });
    const view = wrap(
      <>
        <AccountModal client={mockClient()} open onClose={() => undefined} />
        <CheckoutModal client={mockClient()} brandSlug="atlic" skipCatalog onClose={() => undefined} />
      </>,
      { colorScheme: "dark", allowUserColorScheme: false },
      "171:203",
    );
    void view;

    const account = document.body.querySelector(".gafa-account-overlay");
    const checkout = document.body.querySelector(".gafa-checkout-overlay");
    expect(account?.getAttribute("data-color-scheme")).toBe("dark");
    expect(checkout?.getAttribute("data-color-scheme")).toBe("dark");
    expect(account?.getAttribute("style")).toContain("--gafa-color-text:");
    expect(checkout?.getAttribute("style")).toContain("--gafa-color-text:");
  });

  it("dos compañías en el mismo origin no comparten preferencia", () => {
    localStorage.setItem(themePreferenceStorageKey("1:fitspin"), "dark");

    wrap(<span>marca-b</span>, { colorScheme: "light", allowUserColorScheme: true }, "2:atlic");

    expect(document.querySelector(".gafa-sdk")?.getAttribute("data-color-scheme")).toBe("light");
    expect(localStorage.getItem(themePreferenceStorageKey("1:fitspin"))).toBe("dark");
  });

  it("con lock no escribe la key de preferencia", () => {
    wrap(<span>x</span>, { colorScheme: "dark", allowUserColorScheme: false }, "171:203");
    expect(localStorage.getItem(themePreferenceStorageKey("171:203"))).toBeNull();
    expect(localStorage.getItem("gafa-sdk-color-scheme")).toBeNull();
  });

  it("THEME.logoMaxHeight 110 llega a la variable del overlay", () => {
    const vars = themeToCssVariables(
      { colorScheme: "dark", allowUserColorScheme: false, logoMaxWidth: 220, logoMaxHeight: 110 },
      "dark",
      { followHostSurface: false },
    );
    expect(vars["--gafa-logo-max-width"]).toBe("220px");
    expect(vars["--gafa-logo-max-height"]).toBe("110px");
  });
});
