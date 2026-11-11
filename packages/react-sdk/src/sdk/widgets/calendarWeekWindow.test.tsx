import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { createMockGafaClient } from "../client/gafaClient";
import { clearStoredToken } from "../client/tokenStorage";
import type { GafaClient, Meeting } from "../client/types";
import { addDays, parseIsoDate, todayIsoInZone, toIsoDate } from "./calendarRange";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };
const BRAND_TZ = "America/Mexico_City";

let sdk: GafaSdk | null = null;

function meetingOn(iso: string, passed: boolean, id: number): Meeting {
  return {
    id,
    name: passed ? "Finalizada" : "Disponible",
    startsAt: `${iso}T08:00:00-06:00`,
    timezone: BRAND_TZ,
    passed,
    brandSlug: "fitspin",
    availability: passed ? "sold-out" : "available",
    available: passed ? 0 : 6,
    capacity: 12,
    location: { id: 1, name: "Polanco", slug: "polanco", brandSlug: "fitspin" },
    service: { id: 1, name: "BICICLETA" },
  };
}

function clientWithMeetings(meetings: Meeting[]): GafaClient {
  const base = createMockGafaClient();
  return {
    ...base,
    listBrands: async () => [{ id: 80, name: "Fitspin", slug: "fitspin", timeZone: BRAND_TZ }],
    listLocations: async () => [{ id: 1, name: "Polanco", slug: "polanco", brandSlug: "fitspin" }],
    listMeetings: async () => meetings,
    getMeeting: async ({ meetingId }) => meetings.find((item) => Number(item.id) === Number(meetingId)) ?? null,
  };
}

describe("ventana semanal desde hoy", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
  });

  it("pinta 7 columnas que empiezan hoy, no el lunes civil", async () => {
    sdk = createGafaSdk(CONFIG, { useMockClient: true });
    const root = document.createElement("div");
    document.body.appendChild(root);
    sdk.mountCalendar(root, { view: "week", allowViewChange: false });

    await waitFor(() => {
      expect(root.querySelectorAll(".gafa-week-grid [data-iso]").length).toBe(7);
    });

    const columns = [...root.querySelectorAll(".gafa-week-grid [data-iso]")];
    const today = toIsoDate(new Date());
    expect(columns[0]?.getAttribute("data-iso")).toBe(today);
    expect(columns[6]?.getAttribute("data-iso")).toBe(toIsoDate(addDays(new Date(), 6)));
  });

  it("si el día de consulta ya está Finalizada, esa columna no aparece", async () => {
    const todayIso = todayIsoInZone(new Date(), BRAND_TZ);
    const tomorrowIso = toIsoDate(addDays(parseIsoDate(todayIso), 1));
    sdk = createGafaSdk(CONFIG, { client: clientWithMeetings([meetingOn(todayIso, true, 1), meetingOn(tomorrowIso, false, 2)]) });
    const root = document.createElement("div");
    document.body.appendChild(root);
    sdk.mountCalendar(root, { view: "week", allowViewChange: false });

    await waitFor(() => {
      expect(root.querySelectorAll(".gafa-week-grid [data-iso]").length).toBe(7);
    });

    const columns = [...root.querySelectorAll(".gafa-week-grid [data-iso]")];
    expect(columns.map((node) => node.getAttribute("data-iso"))).not.toContain(todayIso);
    expect(columns[0]?.getAttribute("data-iso")).toBe(tomorrowIso);
    expect(columns[6]?.getAttribute("data-iso")).toBe(toIsoDate(addDays(parseIsoDate(tomorrowIso), 6)));
  });
});
