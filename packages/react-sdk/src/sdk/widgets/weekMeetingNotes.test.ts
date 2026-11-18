import { describe, expect, it } from "vitest";
import { CASA_ONZE_COMPANY_ID, resolveShowWeekMeetingNotes } from "./weekMeetingNotes";

describe("resolveShowWeekMeetingNotes", () => {
  it("Casa Onze (compañía 146) lo prende sin option", () => {
    expect(resolveShowWeekMeetingNotes({ companyId: CASA_ONZE_COMPANY_ID })).toBe(true);
    expect(resolveShowWeekMeetingNotes({ companyId: 146 })).toBe(true);
  });

  it("cualquier otra compañía sigue con la i", () => {
    expect(resolveShowWeekMeetingNotes({ companyId: 80 })).toBe(false);
    expect(resolveShowWeekMeetingNotes({ companyId: 190 })).toBe(false);
    expect(resolveShowWeekMeetingNotes({})).toBe(false);
  });

  it("SHOW_WEEK_MEETING_NOTES true prende en cualquier marca", () => {
    expect(resolveShowWeekMeetingNotes({ companyId: 80, showWeekMeetingNotes: true })).toBe(true);
  });

  it("false explícito apaga incluso Casa Onze", () => {
    expect(resolveShowWeekMeetingNotes({ companyId: 146, showWeekMeetingNotes: false })).toBe(false);
  });
});
