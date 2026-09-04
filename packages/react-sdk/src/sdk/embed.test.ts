import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { bootGafaSdkFromDom, startEmbedWhenReady, type EmbedHostWindow } from "./embed";

const OPTIONS_JSON = JSON.stringify({
  GAFA_FIT_URL: "https://example.gafa.fit",
  COMPANY_ID: 80,
  API_CLIENT: "demo-client",
});

function mountHost(extraHtml = "") {
  document.body.innerHTML = `
    <script data-gf-options type="application/json">${OPTIONS_JSON}</script>
    ${extraHtml}
  `;
}

describe("embed drop-in", () => {
  afterEach(() => {
    const host = window as EmbedHostWindow;
    host.GafaThemeSDK?.unmountAll();
    delete host.GafaThemeSDK;
    delete host.GafaSdk;
    document.body.innerHTML = "";
  });

  it("exige data-gf-options, igual que el theme v1", () => {
    document.body.innerHTML = `<div data-gf-theme="login-register"></div>`;
    expect(() => bootGafaSdkFromDom(document, window, { useMockClient: true })).toThrow(
      /data-gf-options/,
    );
  });

  it("expone window.GafaThemeSDK y monta login-register", async () => {
    mountHost(`<div data-gf-theme="login-register"></div>`);
    const sdk = bootGafaSdkFromDom(document, window, { useMockClient: true });
    expect((window as EmbedHostWindow).GafaThemeSDK).toBe(sdk);
    expect(sdk.config.companyId).toBe(80);
    expect(sdk.config.apiBaseUrl).toBe("https://example.gafa.fit");
    await waitFor(() => {
      expect(
        document.querySelector("[data-gf-theme='login-register']")?.childElementCount,
      ).toBeGreaterThan(0);
    });
  });

  it("startEmbedWhenReady arranca enseguida si el DOM ya está listo", () => {
    mountHost();
    const host: EmbedHostWindow = {};
    startEmbedWhenReady(document, host, { useMockClient: true });
    expect(host.GafaThemeSDK?.config.companyId).toBe(80);
    host.GafaThemeSDK?.unmountAll();
  });

  it("monta Concierge desde data-gafa-v2 y CONCIERGE en data-gf-options", async () => {
    const concierge = {
      id: "demo-studio",
      displayName: "Demo Studio",
      locale: "en-US",
      timezone: "America/New_York",
      buq: { companyId: 999, brands: [{ slug: "demo", name: "Demo", locationIds: ["1"] }] },
      studios: [{
        id: "downtown",
        name: "Downtown",
        city: "New York",
        address: "1 Demo Street",
        mapsUrl: "https://maps.google.com/?q=1+Demo+Street+New+York",
        locationId: "1",
        brandSlug: "demo",
        slug: "downtown",
      }],
      catalog: { version: "demo-1", products: [] },
      routes: {
        web: { home: "/demo-studio", calendar: "/demo-studio/calendar", packages: "/demo-studio/packages" },
        webview: { home: "/demo-studio/app", calendar: "/demo-studio/app/calendar", packages: "/demo-studio/app/packages" },
      },
      contact: { whatsapp: "15555555555" },
      copy: {
        assistantName: "Studio guide",
        greeting: "Welcome to Demo Studio.",
        title: "Studio guide",
        subtitle: "Schedules and passes.",
        fallback: "I can help with schedules, passes, locations, and bookings.",
        scope: "I can only help with this studio's schedules, passes, locations, and bookings.",
      },
      capabilities: {
        schedule: true,
        packages: true,
        memberships: false,
        account: true,
        directReservation: false,
        whatsapp: true,
      },
      theme: { mode: "dark", accent: "#8BE9FD", foreground: "#111827", icon: "calendar" },
      fallbacks: { calendar: true, packages: true, account: true, whatsapp: true },
      security: { allowedOrigins: ["https://demo.example.com"] },
    };
    document.body.innerHTML = `
      <script data-gf-options type="application/json">${JSON.stringify({
        GAFA_FIT_URL: "https://example.gafa.fit",
        COMPANY_ID: 80,
        API_CLIENT: "demo-client",
        CONCIERGE: concierge,
      })}</script>
      <section data-gafa-v2="concierge"></section>
    `;
    bootGafaSdkFromDom(document, window, { useMockClient: true });
    await waitFor(() => {
      expect(document.querySelector("[data-gafa-concierge='demo-studio']")).toBeTruthy();
      expect(document.querySelector('[aria-label="WhatsApp"]')).toBeTruthy();
    });
  });

  it("exige config declarativa y no usa Fitspin como default", () => {
    mountHost(`<section data-gafa-v2="concierge"></section>`);
    expect(() => bootGafaSdkFromDom(document, window, { useMockClient: true })).not.toThrow();
    expect(document.querySelector("[data-gafa-concierge]")).toBeNull();
    expect(document.body.textContent).not.toContain("FITSPIN Concierge");
  });

  it("acepta un fixture solo si el socio lo pide explicitamente", async () => {
    mountHost(`<section data-gafa-v2="concierge" data-gafa-concierge-fixture="demo-studio"></section>`);
    bootGafaSdkFromDom(document, window, { useMockClient: true });
    await waitFor(() => {
      expect(document.querySelector("[data-gafa-concierge='demo-studio']")).toBeTruthy();
      expect(document.body.textContent).not.toContain("FITSPIN Concierge");
    });
  });

  it("data-gafa-v2 es alias de data-gf-theme para no pelear con el v1", async () => {
    mountHost(`<div data-gafa-v2="login-register"></div>`);
    const sdk = bootGafaSdkFromDom(document, window, { useMockClient: true });
    expect((window as EmbedHostWindow).GafaSdk).toBe(sdk);
    expect(document.querySelector("[data-gafa-v2]")?.getAttribute("data-gf-theme")).toBe(
      "login-register",
    );
    await waitFor(() => {
      expect(document.querySelector("[data-gafa-v2]")?.childElementCount).toBeGreaterThan(0);
    });
  });

  it("login-register y mountHeaderControls aplican THEME.headerControls", async () => {
    document.body.innerHTML = `
      <script data-gf-options type="application/json">${JSON.stringify({
        GAFA_FIT_URL: "https://example.gafa.fit",
        COMPANY_ID: 80,
        API_CLIENT: "demo-client",
        THEME: { headerControls: { background: "#8D6363", fontSize: "11px" } },
      })}</script>
      <section data-gf-theme="login-register"></section>
      <div id="header-js"></div>
    `;
    const sdk = bootGafaSdkFromDom(document, window, { useMockClient: true });
    await waitFor(() => {
      expect(document.querySelector("[data-gf-theme='login-register'] .gafa-header-account")).toBeTruthy();
    });
    const declared = document.querySelector<HTMLElement>("[data-gf-theme='login-register'] .gafa-sdk");
    expect(declared?.style.getPropertyValue("--gafa-header-account-background")).toBe("#8D6363");
    expect(declared?.style.getPropertyValue("--gafa-header-account-font-size")).toBe("11px");
    sdk.mountHeaderControls("#header-js");
    await waitFor(() => {
      expect(document.querySelector("#header-js .gafa-header-account")).toBeTruthy();
    });
    const mounted = document.querySelector<HTMLElement>("#header-js .gafa-sdk");
    expect(mounted?.style.getPropertyValue("--gafa-header-account-background")).toBe("#8D6363");
    expect(document.querySelector(".gafa-header-cart")).toBeNull();
  });
});
