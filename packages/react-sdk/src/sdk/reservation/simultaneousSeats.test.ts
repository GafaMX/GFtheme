import { describe, expect, it } from "vitest";
import {
  buildInvitedData,
  canReserveWithCredits,
  findOneCreditCombo,
  isEligibleGuestCombo,
  formatSeatLabels,
  guestsHaveInvalidEmail,
  paymentOptionsForSeats,
  readSimultaneousReservations,
  remapGuestsForSeats,
  resolveSeatObjectIds,
  selectedCreditForReservation,
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
  it("elige el paquete de 1 crédito con precio", () => {
    expect(findOneCreditCombo([{ credits: 5, price: 900 }, { credits: 1, name: "clase", price: 330 }])).toEqual({
      credits: 1,
      name: "clase",
      price: 330,
    });
    expect(findOneCreditCombo([{ credits: 10, price: 2900 }])).toBeUndefined();
  });

  it("nunca elige paquetes de $0, de agregador u ocultos", () => {
    const combos = [
      { credits: 1, name: "FITPASS", price: 0, priceFinal: 0 },
      { credits: 1, name: "walk in GYMPASS (Lomas)", price: 190 },
      { credits: 1, name: "TotalPass", price: 150 },
      { credits: 1, name: "1 clase EFECTIVO", price: 250, raw: { hide_in_front: 1 } },
      { credits: 1, name: "1 Clase Bici Helipuerto", price: 500, priceFinal: 500 },
    ];
    expect(findOneCreditCombo(combos)?.name).toBe("1 Clase Bici Helipuerto");
    expect(findOneCreditCombo(combos.slice(0, 4))).toBeUndefined();
  });

  it("isEligibleGuestCombo usa price_final cuando hay descuento", () => {
    expect(isEligibleGuestCombo({ credits: 1, name: "1 clase", price: 330, priceFinal: 0 })).toBe(false);
    expect(isEligibleGuestCombo({ credits: 1, name: "1 clase", price: 330, priceFinal: 300 })).toBe(true);
  });
});

describe("remapGuestsForSeats", () => {
  const ana = { name: "Ana", email: "ana@x.mx" };
  const beto = { name: "Beto", email: "" };

  it("los datos siguen a su lugar cuando el anfitrión cambia", () => {
    // [1 anfitrión, 2 Ana, 3 Beto] → se quita el 1: el 2 pasa a anfitrión.
    const out = remapGuestsForSeats([seat(1), seat(2), seat(3)], [seat(2), seat(3)], { 1: ana, 2: beto });
    expect(out).toEqual({ 1: beto });
  });

  it("FIFO: al soltar el más viejo no se corren los nombres a otra silla", () => {
    const out = remapGuestsForSeats(
      [seat(1), seat(2), seat(3)],
      toggleSeatSelection([seat(1), seat(2), seat(3)], seat(4), 3),
      { 1: ana, 2: beto },
    );
    // nuevo orden [2,3,4]: 2 (Ana) es anfitrión → se descarta; 3 (Beto) queda en 1.
    expect(out).toEqual({ 1: beto });
  });

  it("volver a un lugar no deja invitados sobrantes", () => {
    expect(remapGuestsForSeats([seat(1), seat(2)], [seat(1)], { 1: ana })).toEqual({});
    expect(buildInvitedData(remapGuestsForSeats([seat(1), seat(2)], [seat(1)], { 1: ana }))).toBeUndefined();
  });

  it("agregar un lugar conserva los existentes", () => {
    expect(remapGuestsForSeats([seat(1), seat(2)], [seat(1), seat(2), seat(5)], { 1: ana })).toEqual({ 1: ana });
  });
});

describe("selectedCreditForReservation", () => {
  const pack = { id: "credits--7--2026-12-31", kind: "credit" as const, name: "10 clases", remaining: 5 };
  const single = { id: "credits--9--2026-12-01", kind: "credit" as const, name: "1 clase", remaining: 1 };
  const membership = { id: "memberships--3--2026-12-31", kind: "membership" as const, name: "Ili" };

  it("con UNA sola opción para varios lugares igual la manda", () => {
    const options = paymentOptionsForSeats([single, membership, pack], 3);
    expect(options).toEqual([pack]);
    expect(selectedCreditForReservation(options[0], options)).toBe("credits--7--2026-12-31");
  });

  it("no manda una opción que ya no aplica a los lugares actuales", () => {
    const options = paymentOptionsForSeats([single, pack], 3);
    expect(selectedCreditForReservation(single, options)).toBeUndefined();
    expect(selectedCreditForReservation(null, options)).toBeUndefined();
  });
});
