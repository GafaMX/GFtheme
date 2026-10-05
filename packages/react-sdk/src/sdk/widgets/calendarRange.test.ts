import { describe, expect, it } from "vitest";
import { fetchRangeFor, meetingDateKey, toIsoDateInZone } from "./calendarRange";

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
