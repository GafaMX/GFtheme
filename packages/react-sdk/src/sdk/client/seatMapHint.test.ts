import { describe, expect, it } from "vitest";
import { readHasSeatMap, reservationShowsSeatMapLayout } from "./seatMapHint";

describe("readHasSeatMap", () => {
  it("lee maps_id / has_map del meeting", () => {
    expect(readHasSeatMap({ maps_id: 12 })).toBe(true);
    expect(readHasSeatMap({ maps_id: null })).toBe(false);
    expect(readHasSeatMap({ has_map: true })).toBe(true);
    expect(readHasSeatMap({ has_map: 0 })).toBe(false);
  });

  it("lee el mapa colgado del salon (room.maps_id)", () => {
    expect(readHasSeatMap({ room: { id: 3, name: "Avia", maps_id: 9 } })).toBe(true);
    expect(readHasSeatMap({ room: { id: 3, name: "Gaura", maps_id: null } })).toBe(false);
  });

  it("un room sin maps_id no implica mapa", () => {
    expect(readHasSeatMap({ rooms_id: 4, room: { id: 4, name: "Salón 1" } })).toBeUndefined();
  });

  it("map: null es sin mapa; map con objetos es con mapa", () => {
    expect(readHasSeatMap({ map: null })).toBe(false);
    expect(readHasSeatMap({ map: { id: 1, objects: [{ id: 2 }] } })).toBe(true);
    expect(readHasSeatMap({ map: { id: 1, objects: [] } })).toBe(false);
  });
});

describe("reservationShowsSeatMapLayout", () => {
  it("sin pista no abre fancy mientras carga: evita el achique", () => {
    expect(
      reservationShowsSeatMapLayout({ hasSeatMap: undefined, hasLoadedSeatMap: false, contextLoading: true }),
    ).toBe(false);
    expect(
      reservationShowsSeatMapLayout({ hasSeatMap: false, hasLoadedSeatMap: false, contextLoading: true }),
    ).toBe(false);
  });

  it("si el listado promete mapa, abre ancho con skeleton", () => {
    expect(
      reservationShowsSeatMapLayout({ hasSeatMap: true, hasLoadedSeatMap: false, contextLoading: true }),
    ).toBe(true);
  });

  it("cuando el contexto trae el mapa, se queda ancho", () => {
    expect(
      reservationShowsSeatMapLayout({ hasSeatMap: false, hasLoadedSeatMap: true, contextLoading: false }),
    ).toBe(true);
  });

  it("clase llena / waitlist no abre fancy aunque el listado prometa mapa", () => {
    expect(
      reservationShowsSeatMapLayout({
        hasSeatMap: true,
        hasLoadedSeatMap: false,
        contextLoading: true,
        soldOut: true,
      }),
    ).toBe(false);
    expect(
      reservationShowsSeatMapLayout({
        hasSeatMap: true,
        hasLoadedSeatMap: true,
        contextLoading: false,
        soldOut: true,
      }),
    ).toBe(false);
  });
});
