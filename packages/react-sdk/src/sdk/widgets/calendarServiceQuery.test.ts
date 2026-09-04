import { describe, expect, it } from "vitest";
import {
  matchServiceIdByName,
  meetingMatchesService,
  parseCalendarServiceDefault,
  readCalendarServiceQueryFromSearch,
  resolveCalendarServiceId,
  resolveCalendarServiceQuery,
  serviceNamesMatch,
} from "./calendarServiceQuery";

describe("readCalendarServiceQueryFromSearch", () => {
  it("lee ?service= numérico (mismo patrón que ?location=)", () => {
    expect(readCalendarServiceQueryFromSearch("?service=42")).toEqual({ serviceId: 42 });
    expect(readCalendarServiceQueryFromSearch("service=42")).toEqual({ serviceId: 42 });
  });

  it("acepta service_id, serviceId y filter_service numérico", () => {
    expect(readCalendarServiceQueryFromSearch("?service_id=12")).toEqual({ serviceId: 12 });
    expect(readCalendarServiceQueryFromSearch("?serviceId=8")).toEqual({ serviceId: 8 });
    expect(readCalendarServiceQueryFromSearch("?filter_service=99")).toEqual({ serviceId: 99 });
  });

  it("acepta el nombre de v1 en filter_service", () => {
    expect(readCalendarServiceQueryFromSearch("?filter_service=Pilates+Reformer")).toEqual({
      serviceName: "Pilates Reformer",
    });
  });

  it("acepta el nombre también en service=", () => {
    expect(readCalendarServiceQueryFromSearch("?service=Barre")).toEqual({ serviceName: "Barre" });
  });

  it("ignora valores vacíos y keys ajenas", () => {
    expect(readCalendarServiceQueryFromSearch("?service=")).toEqual({});
    expect(readCalendarServiceQueryFromSearch("?staff=1")).toEqual({});
    expect(readCalendarServiceQueryFromSearch("")).toEqual({});
  });

  it("service= gana sobre filter_service si vienen los dos", () => {
    expect(readCalendarServiceQueryFromSearch("?service=7&filter_service=Barre")).toEqual({ serviceId: 7 });
  });
});

describe("parseCalendarServiceDefault", () => {
  it("lee id o nombre del atributo HTML", () => {
    expect(parseCalendarServiceDefault("123")).toEqual({ serviceId: 123 });
    expect(parseCalendarServiceDefault("Pilates Reformer")).toEqual({ serviceName: "Pilates Reformer" });
    expect(parseCalendarServiceDefault("  ")).toEqual({});
    expect(parseCalendarServiceDefault(null)).toEqual({});
  });
});

describe("resolveCalendarServiceQuery", () => {
  it("la URL gana sobre filter-bq-service-default", () => {
    expect(resolveCalendarServiceQuery("?service=9", "Pilates Reformer")).toEqual({ serviceId: 9 });
    expect(resolveCalendarServiceQuery("?filter_service=Barre", "11")).toEqual({ serviceName: "Barre" });
  });

  it("cae al atributo si la URL no trae servicio", () => {
    expect(resolveCalendarServiceQuery("", "11")).toEqual({ serviceId: 11 });
    expect(resolveCalendarServiceQuery("?location=200", "Barre")).toEqual({ serviceName: "Barre" });
  });
});

describe("resolveCalendarServiceId", () => {
  it("hereda el default de URL mientras el usuario no toca el select", () => {
    expect(resolveCalendarServiceId(undefined, 42)).toBe(42);
  });

  it("respeta el servicio que eligió el usuario", () => {
    expect(resolveCalendarServiceId(8, 42)).toBe(8);
  });

  it("Todos explícito no vuelve al servicio de la URL", () => {
    expect(resolveCalendarServiceId(null, 42)).toBeUndefined();
  });
});

describe("serviceNamesMatch / matchServiceIdByName", () => {
  it("compara sin mayúsculas, acentos ni espacios de más", () => {
    expect(serviceNamesMatch("Pilates  Reformer", "pilates reformer")).toBe(true);
    expect(serviceNamesMatch("Pílates", "Pilates")).toBe(true);
    expect(serviceNamesMatch("Barre", "Reformer")).toBe(false);
  });

  it("resuelve el id a partir del nombre", () => {
    const services = [
      { id: 10, name: "Pilates Reformer" },
      { id: 11, name: "Barre" },
    ];
    expect(matchServiceIdByName("Pilates+Reformer".replace(/\+/g, " "), services)).toBe(10);
    expect(matchServiceIdByName("barre", services)).toBe(11);
    expect(matchServiceIdByName("Yoga", services)).toBeUndefined();
  });
});

describe("meetingMatchesService", () => {
  const reformer = { service: { id: 10, name: "Pilates Reformer" } };
  const barre = { serviceId: 11, serviceName: "Barre" };

  it("filtra por id", () => {
    expect(meetingMatchesService(reformer, { serviceId: 10 })).toBe(true);
    expect(meetingMatchesService(barre, { serviceId: 10 })).toBe(false);
    expect(meetingMatchesService(barre, { serviceId: 11 })).toBe(true);
  });

  it("filtra por nombre cuando no hay id (v1)", () => {
    expect(meetingMatchesService(reformer, { serviceName: "Pilates Reformer" })).toBe(true);
    expect(meetingMatchesService(barre, { serviceName: "pilates reformer" })).toBe(false);
    expect(meetingMatchesService(barre, { serviceName: "Barre" })).toBe(true);
  });

  it("sin filtro deja pasar", () => {
    expect(meetingMatchesService(reformer, {})).toBe(true);
  });
});
