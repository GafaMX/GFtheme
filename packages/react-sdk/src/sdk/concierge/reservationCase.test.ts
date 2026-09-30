import { describe, expect, it } from "vitest";
import {
  confirmReservationLabel,
  creditChipLabel,
  planReservationCase,
  reservationCaseCopy,
  selectedCreditCopy,
} from "./reservationCase";

const pack = { id: "credits--1", kind: "credit" as const, name: "10 clases", remaining: 5 };
const extra = { id: "credits--2", kind: "credit" as const, name: "Drop-in", remaining: 1 };
const member = { id: "memberships--9", kind: "membership" as const, name: "Ilimitada" };

const ready = {
  signedIn: true,
  hasMap: false,
  soldOut: false,
  waitlistAvailable: false,
  contextReady: true,
};

describe("planReservationCase", () => {
  it("sin sesión abre el popup de auth", () => {
    expect(planReservationCase({ ...ready, signedIn: false, paymentOptions: [pack] })).toEqual({
      kind: "need_auth",
      credits: [],
    });
  });

  it("sin contexto no inventa el camino feliz", () => {
    expect(
      planReservationCase({ ...ready, contextReady: false, paymentOptions: [pack] }),
    ).toEqual({
      kind: "open_reservation",
      credits: [],
      reason: "inspect_unavailable",
    });
  });

  it("clase con mapa abre el salón aunque haya un crédito", () => {
    expect(
      planReservationCase({ ...ready, hasMap: true, paymentOptions: [pack] }),
    ).toEqual({
      kind: "open_reservation",
      credits: [pack],
      reason: "map",
    });
  });

  it("lleno sin waitlist se queda en el chat, aunque el salón tenga mapa", () => {
    expect(
      planReservationCase({
        ...ready,
        hasMap: true,
        soldOut: true,
        waitlistAvailable: false,
        paymentOptions: [pack],
      }),
    ).toEqual({ kind: "full", credits: [pack] });
  });

  it("lleno con waitlist y mapa abre el popup de reserva", () => {
    expect(
      planReservationCase({
        ...ready,
        hasMap: true,
        soldOut: true,
        waitlistAvailable: true,
        paymentOptions: [pack],
      }),
    ).toEqual({
      kind: "open_reservation",
      credits: [pack],
      reason: "map",
    });
  });

  it("camino feliz: cupo, sin mapa, un crédito", () => {
    expect(planReservationCase({ ...ready, paymentOptions: [pack] })).toEqual({
      kind: "confirm_in_chat",
      waitlist: false,
      credits: [pack],
    });
  });

  it("varios créditos, sin mapa: elige en el chat", () => {
    expect(planReservationCase({ ...ready, paymentOptions: [pack, extra] })).toEqual({
      kind: "pick_credit",
      waitlist: false,
      credits: [pack, extra],
    });
  });

  it("sin crédito aplicable pide compra", () => {
    expect(planReservationCase({ ...ready, paymentOptions: [] })).toEqual({
      kind: "need_purchase",
      credits: [],
    });
  });

  it("lleno + waitlist + un crédito, sin mapa: ¿te apunto?", () => {
    expect(
      planReservationCase({
        ...ready,
        soldOut: true,
        waitlistAvailable: true,
        paymentOptions: [pack],
      }),
    ).toEqual({
      kind: "confirm_in_chat",
      waitlist: true,
      credits: [pack],
    });
  });

  it("lleno + waitlist + varios créditos, sin mapa", () => {
    expect(
      planReservationCase({
        ...ready,
        soldOut: true,
        waitlistAvailable: true,
        paymentOptions: [pack, member],
      }),
    ).toEqual({
      kind: "pick_credit",
      waitlist: true,
      credits: [pack, member],
    });
  });

  it("lleno + waitlist sin crédito: comprar para la lista", () => {
    expect(
      planReservationCase({
        ...ready,
        soldOut: true,
        waitlistAvailable: true,
        paymentOptions: [],
      }),
    ).toEqual({
      kind: "need_purchase",
      waitlist: true,
      credits: [],
    });
  });
});

describe("reservation copy", () => {
  it("nombra el crédito en la confirmación y en las pastillas", () => {
    expect(creditChipLabel(pack)).toBe("10 clases · 5 créditos");
    expect(creditChipLabel(member)).toBe("Membresía: Ilimitada");
    expect(confirmReservationLabel(true)).toBe("Apúntame");
    expect(confirmReservationLabel()).toBe("Confirmar reserva");
    expect(
      reservationCaseCopy(
        { kind: "confirm_in_chat", credits: [pack] },
        { className: "Bunker", time: "08:30" },
      ),
    ).toBe("Puedo reservarte Bunker a las 08:30 con tu paquete 10 clases. ¿Confirmas?");
    expect(
      reservationCaseCopy(
        { kind: "open_reservation", credits: [], reason: "map" },
        { className: "Spin", time: "07:00" },
      ),
    ).toBe("Te abro el salón para que elijas tu lugar.");
    expect(selectedCreditCopy(pack, false)).toBe("¿Confirmo la reserva con tu paquete 10 clases?");
  });
});
