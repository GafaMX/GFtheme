import { describe, expect, it } from "vitest";
import {
  calendarLocationSelectValue,
  locationTokensMatch,
  matchLocation,
  parseCalendarLocationDefault,
  readCalendarLocationIdFromSearch,
  readCalendarLocationQueryFromSearch,
  resolveCalendarLocationId,
  resolveCalendarLocationQuery,
} from "./calendarLocationQuery";

const locations = [
  { id: 1, name: "Roma Norte", slug: "roma-norte" },
  { id: 8, name: "San José Insurgentes", slug: "san-jose-insurgentes" },
];

describe("readCalendarLocationQueryFromSearch", () => {
  it("lee ?location= numérico (Fitspin / Replit)", () => {
    expect(readCalendarLocationQueryFromSearch("?location=200")).toEqual({ locationId: 200 });
    expect(readCalendarLocationIdFromSearch("location=200")).toBe(200);
  });

  it("acepta location_id y locationId", () => {
    expect(readCalendarLocationQueryFromSearch("?location_id=122")).toEqual({ locationId: 122 });
    expect(readCalendarLocationQueryFromSearch("?locationId=8")).toEqual({ locationId: 8 });
  });

  it("acepta el nombre de v1 en filter_location", () => {
    expect(readCalendarLocationQueryFromSearch("?filter_location=San+Jose+Insurgentes")).toEqual({
      locationName: "San Jose Insurgentes",
    });
  });

  it("acepta el nombre también en location=", () => {
    expect(readCalendarLocationQueryFromSearch("?location=Roma+Norte")).toEqual({ locationName: "Roma Norte" });
  });

  it("ignora valores vacíos y keys ajenas", () => {
    expect(readCalendarLocationQueryFromSearch("?location=")).toEqual({});
    expect(readCalendarLocationQueryFromSearch("?staff=1")).toEqual({});
    expect(readCalendarLocationQueryFromSearch("")).toEqual({});
  });

  it("location= gana sobre filter_location si vienen los dos", () => {
    expect(readCalendarLocationQueryFromSearch("?location=8&filter_location=Roma+Norte")).toEqual({
      locationId: 8,
    });
  });
});

describe("parseCalendarLocationDefault", () => {
  it("lee id o nombre del atributo HTML", () => {
    expect(parseCalendarLocationDefault("123")).toEqual({ locationId: 123 });
    expect(parseCalendarLocationDefault("San José Insurgentes")).toEqual({
      locationName: "San José Insurgentes",
    });
    expect(parseCalendarLocationDefault("  ")).toEqual({});
    expect(parseCalendarLocationDefault(null)).toEqual({});
  });
});

describe("resolveCalendarLocationQuery", () => {
  it("la URL gana sobre filter-bq-location-default", () => {
    expect(resolveCalendarLocationQuery("?location=9", "Roma Norte")).toEqual({ locationId: 9 });
    expect(resolveCalendarLocationQuery("?filter_location=San+Jose+Insurgentes", "11")).toEqual({
      locationName: "San Jose Insurgentes",
    });
  });

  it("cae al atributo si la URL no trae sede", () => {
    expect(resolveCalendarLocationQuery("", "11")).toEqual({ locationId: 11 });
    expect(resolveCalendarLocationQuery("?service=200", "Roma Norte")).toEqual({ locationName: "Roma Norte" });
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

describe("locationTokensMatch / matchLocation", () => {
  it("compara sin mayúsculas, acentos ni guiones", () => {
    expect(locationTokensMatch("San José Insurgentes", "San Jose Insurgentes")).toBe(true);
    expect(locationTokensMatch("san-jose-insurgentes", "San José Insurgentes")).toBe(true);
    expect(locationTokensMatch("Roma Norte", "Condesa")).toBe(false);
  });

  it("resuelve id por nombre o slug", () => {
    expect(matchLocation({ locationName: "San Jose Insurgentes" }, locations)?.id).toBe(8);
    expect(matchLocation({ locationName: "san-jose-insurgentes" }, locations)?.id).toBe(8);
    expect(matchLocation({ locationId: 1 }, locations)?.name).toBe("Roma Norte");
    expect(matchLocation({ locationName: "Polanco" }, locations)).toBeUndefined();
  });
});
