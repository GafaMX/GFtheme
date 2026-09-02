import { describe, expect, it, vi } from "vitest";
import type { GafaSdk } from "../runtime";
import {
  createConciergeExecutor,
  executeConciergeAction,
  validateConciergeAction,
} from "./actions";
import {
  demoWellnessConciergeFixture,
  fitspinConciergeFixture,
} from "./fixtures";
import type { ConciergeAction, ConciergePartnerConfig } from "./types";

function sdkMock(): GafaSdk {
  return {
    config: {} as GafaSdk["config"],
    client: {} as GafaSdk["client"],
    on: vi.fn(() => vi.fn()),
    emit: vi.fn(),
    mountCalendar: vi.fn(() => ({ root: {} as never, element: document.createElement("div"), unmount: vi.fn() })),
    mountAuth: vi.fn(),
    mountCatalog: vi.fn(),
    mountProfile: vi.fn(),
    mountPurchaseButton: vi.fn(),
    mountHeaderControls: vi.fn(),
    openAccount: vi.fn(() => ({ close: vi.fn() })),
    openCheckout: vi.fn(() => ({
      type: "checkout",
      context: { kind: "checkout" },
      close: vi.fn(),
    })),
    openReservation: vi.fn(() => ({
      type: "reservation",
      context: { kind: "reservation" },
      close: vi.fn(),
    })),
    openReservationCheckout: vi.fn(async () => ({
      type: "reservation",
      context: { kind: "reservation", meetingId: 9001 },
      close: vi.fn(),
    })),
    enablePurchaseButtons: vi.fn(() => vi.fn()),
    unmountAll: vi.fn(),
  };
}

const validReservationAction: ConciergeAction = {
  partnerId: "fitspin",
  type: "OPEN_RESERVATION_CHECKOUT",
  meeting: {
    meetingId: 9001,
    brandSlug: "fitspin-studio",
    locationSlug: "fitspin-roma",
  },
};

describe("concierge action registry", () => {
  it("acepta una reserva declarada en el catalogo del socio", () => {
    expect(validateConciergeAction(fitspinConciergeFixture, validReservationAction)).toEqual({ ok: true });
  });

  it("rechaza acciones de otro partner", () => {
    expect(
      validateConciergeAction(fitspinConciergeFixture, {
        ...validReservationAction,
        partnerId: "demo-wellness",
      }),
    ).toMatchObject({
      ok: false,
      code: "partner_mismatch",
    });
  });

  it("evita mezclar meetings entre socios", () => {
    const demoWithReservationEnabled: ConciergePartnerConfig = {
      ...demoWellnessConciergeFixture,
      capabilities: {
        ...demoWellnessConciergeFixture.capabilities,
        directReservation: true,
      },
    };

    expect(
      validateConciergeAction(demoWithReservationEnabled, {
        ...validReservationAction,
        partnerId: "demo-wellness",
      }),
    ).toMatchObject({
      ok: false,
      code: "brand_not_allowed",
    });
  });

  it("bloquea meetings inventados aunque la marca y sede existan", () => {
    expect(
      validateConciergeAction(fitspinConciergeFixture, {
        ...validReservationAction,
        meeting: {
          ...validReservationAction.meeting,
          meetingId: 999999,
        },
      }),
    ).toMatchObject({
      ok: false,
      code: "meeting_not_allowed",
    });
  });

  it("bloquea productos no declarados en catalogo", () => {
    expect(
      validateConciergeAction(fitspinConciergeFixture, {
        partnerId: "fitspin",
        type: "OPEN_CHECKOUT",
        item: {
          kind: "combo",
          id: 999999,
          brandSlug: "fitspin-studio",
          locationSlug: "fitspin-roma",
          name: "Paquete inventado",
        },
      }),
    ).toMatchObject({
      ok: false,
      code: "item_not_allowed",
    });
  });

  it("respeta capabilities deshabilitadas", () => {
    expect(
      validateConciergeAction(demoWellnessConciergeFixture, {
        partnerId: "demo-wellness",
        type: "OPEN_WHATSAPP",
        message: "Hola",
      }),
    ).toMatchObject({
      ok: false,
      code: "capability_disabled",
    });
  });

  it("ejecuta checkout de reserva usando la API publica V2", async () => {
    const sdk = sdkMock();
    const result = await executeConciergeAction(sdk, fitspinConciergeFixture, validReservationAction);

    expect(result.status).toBe("handled");
    expect(sdk.openReservationCheckout).toHaveBeenCalledWith({
      meetingId: 9001,
      brandSlug: "fitspin-studio",
      locationSlug: "fitspin-roma",
    });
  });

  it("ejecuta compra con preselect allowlisted", async () => {
    const sdk = sdkMock();
    const result = await executeConciergeAction(sdk, fitspinConciergeFixture, {
      partnerId: "fitspin",
      type: "OPEN_CHECKOUT",
      item: fitspinConciergeFixture.catalog!.items![0],
    });

    expect(result.status).toBe("handled");
    expect(sdk.openCheckout).toHaveBeenCalledWith({
      brandSlug: "fitspin-studio",
      locationSlug: "fitspin-roma",
      preselect: { type: "combo", id: 7001 },
      skipCatalog: true,
    });
  });

  it("navega a WhatsApp solo cuando el canal esta configurado", async () => {
    const navigate = vi.fn();
    const result = await executeConciergeAction(sdkMock(), fitspinConciergeFixture, {
      partnerId: "fitspin",
      type: "OPEN_WHATSAPP",
      message: "Quiero reservar",
    }, { navigate });

    expect(result.status).toBe("handled");
    expect(navigate).toHaveBeenCalledWith("https://wa.me/525500000000?text=Quiero%20reservar");
  });

  it("monta calendario en un target controlado", async () => {
    const sdk = sdkMock();
    const target = document.createElement("div");
    const result = await createConciergeExecutor(sdk, fitspinConciergeFixture, {
      calendarTarget: target,
    }).execute({
      partnerId: "fitspin",
      type: "OPEN_CALENDAR",
      brandSlug: "fitspin-studio",
      locationSlug: "fitspin-roma",
    });

    expect(result.status).toBe("handled");
    expect(sdk.mountCalendar).toHaveBeenCalledWith(target, {
      filters: { brand: true, location: true },
    });
  });

  it("requiere target o ruta para abrir calendario", () => {
    const withoutRoute: ConciergePartnerConfig = {
      ...fitspinConciergeFixture,
      routes: {},
    };

    expect(
      validateConciergeAction(withoutRoute, {
        partnerId: "fitspin",
        type: "OPEN_CALENDAR",
      }),
    ).toMatchObject({
      ok: false,
      code: "calendar_target_required",
    });
  });
});
