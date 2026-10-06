import { describe, expect, it } from "vitest";
import { parseFilterFlagValue, readFilterFlag } from "./legacyFilterFlag";

function el(html: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  return wrap.firstElementChild as HTMLElement;
}

describe("readFilterFlag", () => {
  it("sin atributo, servicio y staff quedan encendidos", () => {
    const node = el(`<section data-gf-theme="meetings-calendar" filter-bq-location></section>`);
    expect(readFilterFlag(node, "filter-bq-service", true)).toBe(true);
    expect(readFilterFlag(node, "filter-bq-staff", true)).toBe(true);
    expect(readFilterFlag(node, "filter-bq-location", false)).toBe(true);
    expect(readFilterFlag(node, "filter-bq-brand", false)).toBe(false);
  });

  it("filter-bq-service / staff vacíos o true siguen encendidos", () => {
    const node = el(`<section filter-bq-service filter-bq-staff="true"></section>`);
    expect(readFilterFlag(node, "filter-bq-service", true)).toBe(true);
    expect(readFilterFlag(node, "filter-bq-staff", true)).toBe(true);
  });

  it("false / 0 / off apagan el filtro", () => {
    const node = el(`<section filter-bq-service="false" filter-bq-staff="0"></section>`);
    expect(readFilterFlag(node, "filter-bq-service", true)).toBe(false);
    expect(readFilterFlag(node, "filter-bq-staff", true)).toBe(false);
  });

  it("el false de hasAttribute (Buq-Webs / Fitspin) no apaga servicio ni staff", () => {
    expect(parseFilterFlagValue(false, true)).toBe(true);
    expect(parseFilterFlagValue(undefined, true)).toBe(true);
    expect(parseFilterFlagValue("false", true)).toBe(false);
    expect(parseFilterFlagValue("off", true)).toBe(false);
    expect(parseFilterFlagValue(true, true)).toBe(true);
  });
});
