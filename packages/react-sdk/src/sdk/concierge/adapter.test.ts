import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completeAdapterHandoff,
  createConciergeBrowserAdapter,
  nextDayIso,
  type ConciergeSdkBridge,
} from "./adapter";
import { DEMO_CONCIERGE_CONFIG } from "./fixtures";
import { conciergeProducts } from "./products";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("ConciergeSdkAdapter", () => {
  it("descubre sedes antes de pedir meetings de un solo dia", async () => {
    const calls: string[] = [];
    const sdk: ConciergeSdkBridge = {
      client: {
        async listLocations() {
          calls.push("locations");
          return [{ id: "1", slug: "downtown" }];
        },
        async listMeetings(options: { from: string; to: string }) {
          calls.push(`meetings:${options.from}:${options.to}`);
          return [{
            id: 8,
            startsAt: "2026-08-28T08:30:00-06:00",
            serviceName: "Strength",
            staffName: "Alex",
            available: 4,
          }];
        },
        async getProfile() {
          return null;
        },
        async openReservationCheckout() {},
      },
      openAccount() {},
    };
    const adapter = createConciergeBrowserAdapter({
      config: DEMO_CONCIERGE_CONFIG,
      sdk,
      navigate() {},
    });
    const result = await adapter.listMeetings("1", "2026-08-28");
    expect(calls).toEqual(["locations", "meetings:2026-08-28:2026-08-29"]);
    expect(nextDayIso("2026-08-28")).toBe("2026-08-29");
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.items[0]).toEqual({
        time: "08:30",
        className: "Strength",
        coach: "Alex",
        availableSpots: 4,
        meetingId: 8,
        brandSlug: "demo",
        locationSlug: "downtown",
      });
    }
  });

  it("reporta fallbacks honestos si falta SDK o identificadores de checkout", async () => {
    const adapter = createConciergeBrowserAdapter({
      config: DEMO_CONCIERGE_CONFIG,
      sdk: null,
      navigate() {},
    });
    expect(adapter.openAccount()).toEqual({ opened: false, fallback: true });
    expect(await adapter.buyProduct(DEMO_CONCIERGE_CONFIG.catalog.products[0])).toEqual({
      opened: false,
      fallback: true,
    });
    expect(await adapter.reserveMeeting({
      time: "08:00",
      className: "Strength",
      coach: "",
      availableSpots: null,
      meetingId: 8,
    })).toEqual({ opened: false, fallback: true });
  });

  it("compra con openCheckout nativo solo si aparece el modal real", async () => {
    const sdk: ConciergeSdkBridge = {
      client: {
        async listLocations() { return []; },
        async listMeetings() { return []; },
        async getProfile() { return null; },
        async openReservationCheckout() {},
      },
      openAccount() {},
      openCheckout() {
        const overlay = document.createElement("div");
        overlay.className = "gafa-checkout-overlay";
        document.body.appendChild(overlay);
        return { close() { overlay.remove(); } };
      },
    };
    const adapter = createConciergeBrowserAdapter({
      config: {
        ...DEMO_CONCIERGE_CONFIG,
        catalog: {
          ...DEMO_CONCIERGE_CONFIG.catalog,
          products: [{
            type: "combo",
            id: "971",
            brandSlug: "demo",
            locationId: "1",
            name: "Drop-in",
            price: "$20",
            note: "Valid for 30 days",
          }],
        },
      },
      sdk,
      navigate() {},
    });
    expect(await adapter.buyProduct({
      type: "combo",
      id: "971",
      brandSlug: "demo",
      locationId: "1",
      name: "Drop-in",
      price: "$20",
      note: "Valid for 30 days",
    })).toEqual({ opened: true, fallback: false });
  });

  it("compra por data-gf-buy y confirma el modal si no hay openCheckout", async () => {
    let clicked = false;
    const sdk: ConciergeSdkBridge = {
      client: {
        async listLocations() { return []; },
        async listMeetings() { return []; },
        async getProfile() { return null; },
        async openReservationCheckout() {},
      },
      openAccount() {},
      enablePurchaseButtons() {
        document.querySelector<HTMLButtonElement>("[data-gf-buy]")?.addEventListener("click", () => {
          clicked = true;
          const overlay = document.createElement("div");
          overlay.className = "gafa-checkout-overlay";
          document.body.appendChild(overlay);
        });
        return () => {};
      },
    };
    const adapter = createConciergeBrowserAdapter({
      config: DEMO_CONCIERGE_CONFIG,
      sdk,
      navigate() {},
    });
    expect(await adapter.buyProduct(DEMO_CONCIERGE_CONFIG.catalog.products[0])).toEqual({
      opened: true,
      fallback: false,
    });
    expect(clicked).toBe(true);
    expect(document.querySelector("[data-gf-buy]")?.getAttribute("data-gf-combo-id")).toBe("demo-combo");
  });

  it("oculta membresias y no navega si schedule/packages estan apagados", async () => {
    const membershipConfig = {
      ...DEMO_CONCIERGE_CONFIG,
      catalog: {
        ...DEMO_CONCIERGE_CONFIG.catalog,
        products: [
          ...DEMO_CONCIERGE_CONFIG.catalog.products,
          { type: "membership" as const, id: "member", brandSlug: "demo", locationId: "1", name: "Member", price: "$50", note: "" },
        ],
      },
    };
    expect(conciergeProducts(membershipConfig).map((product) => product.id)).toEqual(["demo-combo"]);
    const disabled = {
      ...membershipConfig,
      capabilities: { ...membershipConfig.capabilities, packages: false, schedule: false },
    };
    const navigated: string[] = [];
    const adapter = createConciergeBrowserAdapter({
      config: disabled,
      sdk: null,
      navigate: (path) => navigated.push(path),
    });
    adapter.openCalendar();
    adapter.openPackages();
    expect(navigated).toEqual([]);
    expect((await adapter.listMeetings("1", "2026-08-28")).status).toBe("sdk_unavailable");
  });

  it("un handoff exitoso cierra el chat y el fallback queda explicito", () => {
    const events: string[] = [];
    completeAdapterHandoff({ opened: true, fallback: false }, () => events.push("close"), () => events.push("fallback"));
    completeAdapterHandoff({ opened: false, fallback: true }, () => events.push("close"), () => events.push("fallback"));
    expect(events).toEqual(["close", "fallback"]);
  });
});
