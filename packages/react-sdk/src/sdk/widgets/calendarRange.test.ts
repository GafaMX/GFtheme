import { describe, expect, it } from "vitest";
import { addDays, fetchRangeFor, meetingDateKey, rangeForView, shiftAnchor, toIsoDate, toIsoDateInZone } from "./calendarRange";

describe("toIsoDateInZone", () => {
  // 6:00 CEST del martes 6 oct = 04:00 UTC = 22:00 CDMX del lunes 5.
  const sixAmMadrid = new Date("2026-10-06T06:00:00+02:00");

  it("deja la clase de las 6am en el martes de Madrid", () => {
    expect(toIsoDateInZone(sixAmMadrid, "Europe/Madrid")).toBe("2026-10-06");
  });

  it("en México esa misma instantánea cae el lunes", () => {
    expect(toIsoDateInZone(sixAmMadrid, "America/Mexico_City")).toBe("2026-10-05");
  });

  it("sin zona usa el reloj local (mismo contrato que toIsoDate)", () => {
    const local = new Date(2026, 9, 6, 6, 0, 0);
    expect(toIsoDateInZone(local)).toBe("2026-10-06");
  });
});

describe("meetingDateKey", () => {
  it("agrupa 6:00 Madrid con la TZ de la marca, no con la del navegador", () => {
    expect(meetingDateKey("2026-10-06T06:00:00+02:00", "Europe/Madrid")).toBe("2026-10-06");
    expect(meetingDateKey("2026-10-05T22:00:00-06:00", "Europe/Madrid")).toBe("2026-10-06");
  });

  it("acepta el espacio de start_date de Laravel", () => {
    expect(meetingDateKey("2026-10-06 06:00:00+02:00", "Europe/Madrid")).toBe("2026-10-06");
  });

  it("si el ISO no parsea, usa los primeros 10 caracteres", () => {
    expect(meetingDateKey("2026-10-06 no-es-fecha")).toBe("2026-10-06");
  });
});

describe("rangeForView week", () => {
  const thursday = new Date(2026, 9, 1, 12, 0, 0);

  it("arranca el día de consulta y cubre 7 días, no lunes–domingo", () => {
    expect(rangeForView(thursday, "week", thursday)).toEqual({
      from: "2026-10-01",
      to: "2026-10-07",
    });
  });

  it("un lunes coincide con la semana civil, pero sigue siendo 7 desde hoy", () => {
    const monday = new Date(2026, 9, 5, 9, 0, 0);
    expect(rangeForView(monday, "week", monday)).toEqual({
      from: "2026-10-05",
      to: "2026-10-11",
    });
  });

  it("si el ancla quedó en el pasado, recorta hasta hoy", () => {
    const lastMonday = new Date(2026, 8, 28, 9, 0, 0);
    expect(rangeForView(lastMonday, "week", thursday)).toEqual({
      from: "2026-10-01",
      to: "2026-10-07",
    });
  });

  it("la siguiente ventana son otros 7 días hacia adelante", () => {
    const next = new Date(2026, 9, 8, 12, 0, 0);
    expect(rangeForView(next, "week", thursday)).toEqual({
      from: "2026-10-08",
      to: "2026-10-14",
    });
  });

  it("desde hoy no hay semana anterior (el ancla caería antes de hoy)", () => {
    expect(toIsoDate(shiftAnchor(thursday, "week", -1)) < toIsoDate(thursday)).toBe(true);
    expect(toIsoDate(addDays(thursday, -7))).toBe("2026-09-24");
  });
});

describe("fetchRangeFor", () => {
  it("el day view pide el día previo y el end exclusivo", () => {
    expect(fetchRangeFor({ from: "2026-10-06", to: "2026-10-06" })).toEqual({
      from: "2026-10-05",
      to: "2026-10-07",
    });
  });

  it("la semana también trae un día de colchón a cada lado", () => {
    expect(fetchRangeFor({ from: "2026-10-05", to: "2026-10-11" })).toEqual({
      from: "2026-10-04",
      to: "2026-10-12",
    });
  });
});
