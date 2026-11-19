import { describe, expect, it } from "vitest";
import { dayEndInZone, dayStartInZone } from "../src/mexicoCity";

describe("días en America/Mexico_City", () => {
  it("el 18 de noviembre 2026 empieza a las 06:00Z (UTC-6)", () => {
    expect(dayStartInZone("2026-11-18")).toBe("2026-11-18T06:00:00.000Z");
    expect(dayEndInZone("2026-11-18")).toBe("2026-11-19T05:59:59.999Z");
  });
});
