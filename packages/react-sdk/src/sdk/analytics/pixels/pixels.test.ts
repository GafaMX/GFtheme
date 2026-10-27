import { afterEach, describe, expect, it, vi } from "vitest";
import { createSdkTracker } from "../tracker";
import { createPixelRuntime, installConsentSurface, mapTrackerEvent, readPixelsConfig } from "./index";
import { resetPixelDedupForTests, stablePixelEventId } from "./eventId";
import { hashEmail, normalizeEmail, normalizePhone, sha256Hex } from "./hash";
import { currencyFromUnknown, payloadHasPii, stripPii } from "./map";
import { installPixelDebugMocks, readPixelDebugLog } from "./debug";
import { scriptsInjected } from "./loaders";
import type { TrackInput } from "../events";

function pixelWindow() {
  return window as Window & {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (...args: unknown[]) => void; page: (...args: unknown[]) => void };
    gtag?: (...args: unknown[]) => void;
    BuqSDK?: { setConsent?(consent: { marketing?: boolean }): void };
    __BUQ_PIXEL_LOG?: Array<{ provider: string; args: unknown[] }>;
  };
}

function enabledOptions(extra: Record<string, unknown> = {}) {
  return {
    PIXELS_ENABLED: true,
    PIXELS_CONSENT_MODE: "implied",
    META_PIXEL_ID: "111",
    TIKTOK_PIXEL_ID: "222",
    GA4_MEASUREMENT_ID: "G-TEST",
    GOOGLE_ADS_ID: "AW-TEST",
    GOOGLE_ADS_PURCHASE_LABEL: "buy",
    ...extra,
  };
}

function boot(extra: Record<string, unknown> = {}) {
  installPixelDebugMocks();
  const runtime = createPixelRuntime({
    analyticsEnabled: true,
    options: enabledOptions(extra),
  });
  const tracker = runtime.wrap(
    createSdkTracker({ hubUrl: "https://hub.example", companyId: 80, enabled: true }),
  );
  return { runtime, tracker };
}

afterEach(() => {
  resetPixelDedupForTests();
  vi.restoreAllMocks();
  document.querySelectorAll("script[data-buq-pixel]").forEach((node) => node.remove());
  const w = pixelWindow();
  delete w.fbq;
  delete w.ttq;
  delete w.gtag;
  delete w.BuqSDK;
  delete w.__BUQ_PIXEL_LOG;
  sessionStorage.clear();
});

describe("mapa de eventos", () => {
  it("traduce los 7 eventos canónicos y ignora waitlist/failed", () => {
    const cases: Array<[TrackInput["event"], string]> = [
      ["page_view", "page_view"],
      ["catalog.item_opened", "view_content"],
      ["calendar.meeting_opened", "view_content"],
      ["cart.item_added", "add_to_cart"],
      ["checkout.opened", "initiate_checkout"],
      ["checkout.paid", "purchase"],
      ["reservation.confirmed", "schedule"],
      ["auth.registered", "complete_registration"],
    ];
    for (const [event, name] of cases) {
      expect(mapTrackerEvent({ event, props: { purchase_id: 9, reservation_id: 3 } })?.name).toBe(name);
    }
    expect(mapTrackerEvent({ event: "reservation.waitlisted" })).toBeNull();
    expect(mapTrackerEvent({ event: "checkout.failed" })).toBeNull();
    expect(mapTrackerEvent({ event: "auth.login_succeeded" })).toBeNull();
  });
});

describe("event_id", () => {
  it("es estable para purchase y schedule", () => {
    expect(
      stablePixelEventId("purchase", { event: "checkout.paid", props: { purchase_id: 88 } }),
    ).toBe("buq_purchase_88");
    expect(
      stablePixelEventId("schedule", { event: "reservation.confirmed", props: { reservation_id: 12 } }),
    ).toBe("buq_schedule_12");
    const other = stablePixelEventId("view_content", { event: "catalog.item_opened" });
    expect(other.startsWith("buq_view_content_")).toBe(true);
  });

  it("no dispara purchase dos veces al recargar", () => {
    const first = boot();
    first.tracker.track({ event: "checkout.paid", widget: "checkout", props: { purchase_id: 77, value: 330, currency: "MXN" } });
    const afterFirst = readPixelDebugLog().filter((row) => row.args.includes("Purchase") || row.args.includes("CompletePayment") || row.args.includes("purchase"));
    expect(afterFirst.length).toBeGreaterThan(0);

    const second = boot();
    second.tracker.track({ event: "checkout.paid", widget: "checkout", props: { purchase_id: 77, value: 330, currency: "MXN" } });
    const purchases = readPixelDebugLog().filter((row) => row.args.includes("Purchase"));
    expect(purchases).toHaveLength(1);
  });
});

describe("carga", () => {
  it("no carga scripts sin consentimiento en modo required", () => {
    installPixelDebugMocks();
    const runtime = createPixelRuntime({
      analyticsEnabled: true,
      options: enabledOptions({ PIXELS_CONSENT_MODE: "required" }),
    });
    const tracker = runtime.wrap(createSdkTracker({ hubUrl: "https://hub.example", companyId: 1 }));
    tracker.track({ event: "page_view" });
    expect(scriptsInjected()).toEqual([]);
    expect(runtime.bridge.getConsent().marketing).toBe(false);
  });

  it("no carga nada sin ID ni con PIXELS_ENABLED false", () => {
    const none = createPixelRuntime({
      analyticsEnabled: true,
      options: { PIXELS_ENABLED: true, PIXELS_CONSENT_MODE: "implied" },
    });
    none.wrap(createSdkTracker({ hubUrl: "https://hub.example", companyId: 1 })).track({ event: "page_view" });
    expect(scriptsInjected()).toEqual([]);

    const off = createPixelRuntime({
      analyticsEnabled: true,
      options: enabledOptions({ PIXELS_ENABLED: false }),
    });
    off.wrap(createSdkTracker({ hubUrl: "https://hub.example", companyId: 1 })).track({ event: "page_view" });
    expect(scriptsInjected()).toEqual([]);
  });

  it("ANALYTICS false apaga los píxeles", () => {
    const runtime = createPixelRuntime({
      analyticsEnabled: false,
      options: enabledOptions(),
    });
    expect(runtime.config.enabled).toBe(false);
  });

  it("reutiliza fbq/gtag/ttq del host y no inyecta script", () => {
    installPixelDebugMocks();
    boot();
    expect(scriptsInjected()).toEqual([]);
    expect(typeof pixelWindow().fbq).toBe("function");
  });
});

describe("hash y moneda", () => {
  it("SHA-256 del email normalizado", async () => {
    expect(normalizeEmail("  Ana@Fitspin.MX ")).toBe("ana@fitspin.mx");
    expect(normalizePhone("+52 55 1122 3344")).toBe("525511223344");
    const hex = await sha256Hex("ana@fitspin.mx");
    expect(hex).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashEmail("  Ana@Fitspin.MX ")).toBe(hex);
  });

  it("usa EUR o MXN reales, nunca una fija", () => {
    expect(currencyFromUnknown("EUR")).toBe("EUR");
    expect(currencyFromUnknown("MXN")).toBe("MXN");
    expect(currencyFromUnknown({ code3: "EUR" })).toBe("EUR");
    expect(currencyFromUnknown(undefined)).toBeUndefined();
    const mapped = mapTrackerEvent({
      event: "checkout.paid",
      props: { purchase_id: 1, value: 40, currency: "EUR" },
    });
    expect(mapped?.payload.currency).toBe("EUR");
    const mxn = mapTrackerEvent({
      event: "checkout.paid",
      props: { purchase_id: 2, value: 330, currency: "MXN" },
    });
    expect(mxn?.payload.currency).toBe("MXN");
  });
});

describe("privacidad", () => {
  it("no manda PII en claro en el payload", () => {
    const dirty = stripPii({
      value: 10,
      currency: "MXN",
      email: "ana@fitspin.mx",
      user_email: "ana@fitspin.mx",
      user_name: "Ana",
      phone: "5511223344",
    });
    expect(dirty).toEqual({ value: 10, currency: "MXN" });
    expect(payloadHasPii({ email: "a@b.c" })).toBe(true);
    expect(payloadHasPii({ value: 10, currency: "MXN" })).toBe(false);

    const { tracker } = boot();
    tracker.track({
      event: "checkout.paid",
      props: {
        purchase_id: 5,
        value: 330,
        currency: "MXN",
        user_email: "ana@fitspin.mx",
        user_name: "Ana Ruiz",
      },
    });
    const blob = JSON.stringify(readPixelDebugLog());
    expect(blob).not.toMatch(/ana@fitspin\.mx/i);
    expect(blob).not.toMatch(/Ana Ruiz/);
    expect(blob).not.toMatch(/5511223344/);
  });

  it("setConsent y buq:consent:granted habilitan el envío", () => {
    installPixelDebugMocks();
    const runtime = createPixelRuntime({
      analyticsEnabled: true,
      options: enabledOptions({ PIXELS_CONSENT_MODE: "required" }),
    });
    const tracker = runtime.wrap(createSdkTracker({ hubUrl: "https://hub.example", companyId: 1 }));
    installConsentSurface(runtime);
    tracker.track({ event: "page_view" });
    expect(readPixelDebugLog().some((row) => row.args.includes("PageView"))).toBe(false);
    pixelWindow().BuqSDK?.setConsent?.({ marketing: true });
    expect(readPixelDebugLog().some((row) => row.args.includes("PageView"))).toBe(true);
  });
});

describe("config", () => {
  it("lee keys HTML y camelCase; default pixels off y consent required", () => {
    expect(readPixelsConfig({})).toMatchObject({ enabled: false, consentMode: "required" });
    expect(
      readPixelsConfig({
        pixelsEnabled: true,
        metaPixelId: "9",
        pixelsConsentMode: "implied",
      }),
    ).toMatchObject({ enabled: true, metaPixelId: "9", consentMode: "implied" });
  });

  it("deja event_id en props del Hub", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);
    const { tracker } = boot();
    tracker.track({ event: "checkout.paid", props: { purchase_id: 42, currency: "MXN", value: 1 } });
    tracker.flush();
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)) as {
      events: Array<{ props?: { event_id?: string } }>;
    };
    expect(body.events[0].props?.event_id).toBe("buq_purchase_42");
  });
});
