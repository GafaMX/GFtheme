import { describe, expect, it } from "vitest";
import {
  calendarLocationSelectValue,
  readCalendarLocationIdFromSearch,
  resolveCalendarLocationId,
} from "./calendarLocationQuery";

describe("readCalendarLocationIdFromSearch", () => {
  it("lee ?location= numérico (Fitspin / Replit)", () => {
    expect(readCalendarLocationIdFromSearch("?location=200")).toBe(200);
    expect(readCalendarLocationIdFromSearch("location=200")).toBe(200);
  });

  it("acepta location_id y locationId", () => {
    expect(readCalendarLocationIdFromSearch("?location_id=122")).toBe(122);
    expect(readCalendarLocationIdFromSearch("?locationId=8")).toBe(8);
  });

  it("ignora valores no numéricos y ausentes", () => {
    expect(readCalendarLocationIdFromSearch("?location=cancun")).toBeUndefined();
    expect(readCalendarLocationIdFromSearch("?staff=1")).toBeUndefined();
    expect(readCalendarLocationIdFromSearch("")).toBeUndefined();
  });
});

describe("resolveCalendarLocationId", () => {
  it("hereda el default de URL mientras el usuario no toca el select", () => {
    expect(resolveCalendarLocationId(undefined, 200)).toBe(200);
  });

  it("respeta la sede que eligió el usuario", () => {
    expect(resolveCalendarLocationId(91, 200)).toBe(91);
  });

  it("Todos explícito no vuelve a la sede de la URL", () => {
    expect(resolveCalendarLocationId(null, 200)).toBeUndefined();
  });
});

describe("calendarLocationSelectValue", () => {
  it("pinta la sede de la URL, no Todos", () => {
    expect(calendarLocationSelectValue(undefined, 200)).toBe("200");
  });

  it("pinta Todos cuando el usuario lo elige", () => {
    expect(calendarLocationSelectValue(null, 200)).toBe("");
  });
});
