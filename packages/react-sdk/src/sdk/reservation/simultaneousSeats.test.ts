import { describe, expect, it } from "vitest";
import {
  buildInvitedData,
  canReserveWithCredits,
  findOneCreditCombo,
  formatSeatLabels,
  guestsHaveInvalidEmail,
  paymentOptionsForSeats,
  readSimultaneousReservations,
  resolveSeatObjectIds,
  toggleSeatSelection,
} from "./simultaneousSeats";
import type { SeatMapObject } from "../client/types";

function seat(id: number): SeatMapObject {
  return {
    id,
    row: 1,
    column: id,
    width: 1,
    height: 1,
    label: String(id),
    type: "public",
    isBlocked: false,
    isOccupied: false,
  };
}

describe("readSimultaneousReservations", () => {
  it("lee el tope del brand anidado en location", () => {
    expect(
      readSimultaneousReservations({
        brand: { simultaneous_reservations: 3 },
      }),
    ).toBe(3);
  });

  it("parsea el JSON del create-form-template", () => {
    expect(
      readSimultaneousReservations(
        JSON.stringify({ brand: { simultaneous_reservations: "5" } }),
      ),
    ).toBe(5);
  });

  it("cae a 1 si falta o es inválido", () => {
    expect(readSimultaneousReservations(null)).toBe(1);
    expect(readSimultaneousReservations({ brand: {} })).toBe(1);
    expect(readSimultaneousReservations({ brand: { simultaneous_reservations: 0 } })).toBe(1);
  });
});

describe("toggleSeatSelection", () => {
  it("con tope 1 reemplaza el lugar", () => {
    expect(toggleSeatSelection([seat(1)], seat(2), 1).map((item) => item.id)).toEqual([2]);
  });

  it("con tope 3 agrega y al cuarto suelta el más viejo", () => {
    const three = [seat(1), seat(2), seat(3)];
    expect(toggleSeatSelection(three, seat(4), 3).map((item) => item.id)).toEqual([2, 3, 4]);
  });

  it("quita un lugar ya elegido", () => {
    expect(toggleSeatSelection([seat(1), seat(2)], seat(1), 3).map((item) => item.id)).toEqual([2]);
  });
});

describe("resolveSeatObjectIds", () => {
  it("prefiere el array y cae al id suelto", () => {
    expect(resolveSeatObjectIds({ seatObjectIds: [10, 11], seatObjectId: 10 })).toEqual([10, 11]);
    expect(resolveSeatObjectIds({ seatObjectId: 7 })).toEqual([7]);
    expect(resolveSeatObjectIds({})).toEqual([]);
  });
});

describe("buildInvitedData", () => {
  it("omite huecos y no manda objeto vacío", () => {
    expect(buildInvitedData({})).toBeUndefined();
    expect(buildInvitedData({ 1: { name: "  ", email: "" } })).toBeUndefined();
    expect(buildInvitedData({ 1: { name: " Ana ", email: " ana@x.com " } })).toEqual({
      "1": { name: "Ana", email: "ana@x.com" },
    });
  });
});

describe("guest email", () => {
  it("vacío pasa; mal formado no", () => {
    expect(guestsHaveInvalidEmail({ 1: { name: "Ana", email: "" } })).toBe(false);
    expect(guestsHaveInvalidEmail({ 1: { name: "Ana", email: "ana" } })).toBe(true);
  });
});

describe("paymentOptionsForSeats", () => {
  const options = [
    { id: "c1", kind: "credit" as const, name: "10", remaining: 5 },
    { id: "c2", kind: "credit" as const, name: "1", remaining: 1 },
    { id: "m1", kind: "membership" as const, name: "Ili" },
  ];

  it("con una silla deja membresía y cualquier crédito", () => {
    expect(paymentOptionsForSeats(options, 1)).toHaveLength(3);
  });

  it("con 3 sillas solo el paquete que alcanza; sin membresía", () => {
    expect(paymentOptionsForSeats(options, 3).map((option) => option.id)).toEqual(["c1"]);
    expect(canReserveWithCredits(options, 3)).toBe(true);
    expect(canReserveWithCredits(options.slice(1), 3)).toBe(false);
  });
});

describe("formatSeatLabels", () => {
  it("lista en español", () => {
    expect(formatSeatLabels(["1"])).toBe("1");
    expect(formatSeatLabels(["1", "2"])).toBe("1 y 2");
    expect(formatSeatLabels(["1", "2", "3"])).toBe("1, 2 y 3");
  });
});

describe("findOneCreditCombo", () => {
  it("elige el paquete de 1 crédito", () => {
    expect(findOneCreditCombo([{ credits: 5 }, { credits: 1, name: "clase" }])).toEqual({
      credits: 1,
      name: "clase",
    });
    expect(findOneCreditCombo([{ credits: 10 }])).toBeUndefined();
  });
});
