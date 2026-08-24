import { describe, expect, it } from "vitest";
import type { Meeting } from "./types";
import {
  availabilityFromCapacity,
  getAvailabilityText,
  isSoldOut,
  offersWaitlist,
  readWaitlistAvailable,
  fullClassAction,
} from "./meetingAvailability";

function meeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 1,
    name: "CIKLE",
    startsAt: "2026-08-24T18:45:00",
    ...overrides,
  };
}

describe("isSoldOut", () => {
  it("0 lugares libres es lleno", () => {
    expect(isSoldOut(meeting({ available: 0, capacity: 13 }))).toBe(true);
  });

  it("con cupo libre no está lleno", () => {
    expect(isSoldOut(meeting({ available: 3, capacity: 13 }))).toBe(false);
  });
});

describe("offersWaitlist", () => {
  it("una clase llena sin flag se ofrece como waitlist (Voltio)", () => {
    expect(offersWaitlist(meeting({ available: 0, capacity: 13 }))).toBe(true);
  });

  it("respeta availability: waitlist aunque también traiga 0/N", () => {
    expect(offersWaitlist(meeting({ available: 0, capacity: 12, availability: "waitlist" }))).toBe(true);
  });

  it("si el API dice que no hay waitlist, no la inventa", () => {
    expect(offersWaitlist(meeting({ available: 0, capacity: 10, waitlistAvailable: false }))).toBe(false);
  });

  it("no ofrece waitlist en clases pasadas ni ya reservadas", () => {
    expect(offersWaitlist(meeting({ available: 0, passed: true }))).toBe(false);
    expect(offersWaitlist(meeting({ available: 0, isReserved: true }))).toBe(false);
  });
});

describe("getAvailabilityText", () => {
  it("en clase llena dice lista de espera, no 0/13 lugares", () => {
    expect(getAvailabilityText(meeting({ available: 0, capacity: 13 }))).toBe("Lista de espera");
  });

  it("con cupo libre sigue mostrando el conteo", () => {
    expect(getAvailabilityText(meeting({ available: 4, capacity: 13 }))).toBe("4/13 lugares");
  });
});

describe("readWaitlistAvailable", () => {
  it("lee is_valid_for_waitlist del template y del listado", () => {
    expect(readWaitlistAvailable({ is_valid_for_waitlist: true })).toBe(true);
    expect(readWaitlistAvailable({ waitlist_available: 0 })).toBe(false);
    expect(readWaitlistAvailable({ maps_id: 3 })).toBeUndefined();
  });
});

describe("availabilityFromCapacity", () => {
  it("mapea 0 disponibles a waitlist salvo flag en falso", () => {
    expect(availabilityFromCapacity({ available: 0 })).toBe("waitlist");
    expect(availabilityFromCapacity({ available: 0, waitlistAvailable: false })).toBe("sold-out");
    expect(availabilityFromCapacity({ available: 5 })).toBe("available");
  });
});

describe("fullClassAction", () => {
  const ready = { soldOut: true, contextReady: true };

  it("con waitlist y crédito: unirse ahora (el servidor descuenta)", () => {
    expect(fullClassAction({ ...ready, waitlistEnabled: true, hasPaymentOption: true })).toBe("join-waitlist");
  });

  it("con waitlist y sin crédito: hay que comprar, luego el reservate te mete a la lista", () => {
    expect(fullClassAction({ ...ready, waitlistEnabled: true, hasPaymentOption: false })).toBe("buy-to-waitlist");
  });

  it("estudio sin waitlist: clase llena, no se ofrece lista", () => {
    expect(fullClassAction({ ...ready, waitlistEnabled: false, hasPaymentOption: true })).toBe("full");
    expect(fullClassAction({ ...ready, waitlistEnabled: false, hasPaymentOption: false })).toBe("full");
  });

  it("sin contexto todavía no decide", () => {
    expect(
      fullClassAction({ soldOut: true, waitlistEnabled: true, hasPaymentOption: true, contextReady: false }),
    ).toBe("none");
  });
});
