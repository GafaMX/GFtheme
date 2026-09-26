import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { createMockGafaClient } from "../client/gafaClient";
import { clearStoredToken } from "../client/tokenStorage";
import type { GafaClient, Location, Meeting } from "../client/types";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };

let sdk: GafaSdk | null = null;

const LOCATIONS: Location[] = [
  { id: 1, name: "Roma Norte", slug: "roma-norte", brandSlug: "demo-studio" },
  { id: 2, name: "Condesa", slug: "condesa", brandSlug: "demo-studio" },
  { id: 8, name: "San José Insurgentes", slug: "san-jose-insurgentes", brandSlug: "demo-studio" },
];

function isoToday(hours: number): string {
  const date = new Date();
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

function meetings(): Meeting[] {
  return [
    {
      id: 201,
      name: "Reformer Roma",
      startsAt: isoToday(9),
      brandSlug: "demo-studio",
      service: { id: 10, name: "Pilates Reformer" },
      location: LOCATIONS[0],
      availability: "available",
      available: 6,
      capacity: 12,
    },
    {
      id: 202,
      name: "Barre Condesa",
      startsAt: isoToday(11),
      brandSlug: "demo-studio",
      service: { id: 11, name: "Barre" },
      location: LOCATIONS[1],
      availability: "available",
      available: 4,
      capacity: 12,
    },
    {
      id: 203,
      name: "Yoga Insurgentes",
      startsAt: isoToday(18),
      brandSlug: "demo-studio",
      service: { id: 12, name: "Yoga" },
      location: LOCATIONS[2],
      availability: "available",
      available: 5,
      capacity: 12,
    },
  ];
}

function clientWithLocations(): GafaClient {
  const base = createMockGafaClient();
  return {
    ...base,
    listLocations: async () => LOCATIONS,
    listMeetings: async (filters) => {
      const all = meetings();
      if (filters?.locationId == null) return all;
      return all.filter((meeting) => Number(meeting.location?.id) === Number(filters.locationId));
    },
    getMeeting: async ({ meetingId }) => meetings().find((item) => Number(item.id) === Number(meetingId)) ?? null,
  };
}

function mountCalendar(filters: NonNullable<Parameters<GafaSdk["mountCalendar"]>[1]>["filters"] = { location: true }) {
  sdk = createGafaSdk(CONFIG, { client: clientWithLocations() });
  const root = document.createElement("div");
  document.body.appendChild(root);
  sdk.mountCalendar(root, { view: "week", allowViewChange: false, filters });
  return root;
}

function setSearch(search: string) {
  window.history.replaceState({}, "", search ? `/${search}` : "/");
}

function locationSelect(root: HTMLElement): HTMLSelectElement {
  return root.querySelector('.gafa-filterbar-location select') as HTMLSelectElement;
}

function meetingNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".gafa-meeting-name")).map((node) => node.textContent ?? "");
}

function meetingLocations(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".gafa-meeting-location")).map((node) => node.textContent ?? "");
}

describe("filtro de sede por URL / default", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
    setSearch("");
  });

  it("?filter_location=San+Jose+Insurgentes (v1) arranca en esa sede, no en Todos", async () => {
    setSearch("?filter_location=San+Jose+Insurgentes");
    const root = mountCalendar();

    await waitFor(() => {
      expect(locationSelect(root).value).toBe("8");
      const places = meetingLocations(root);
      expect(places.length).toBeGreaterThan(0);
      expect(places.every((place) => place.includes("San José Insurgentes"))).toBe(true);
      expect(meetingNames(root).some((name) => name.includes("Yoga"))).toBe(true);
      expect(meetingNames(root).some((name) => name.includes("Pilates") || name.includes("Barre"))).toBe(false);
    });
  });

  it("?location=8 filtra por id y no se resetea a Todos al cargar bookable", async () => {
    setSearch("?location=8");
    const root = mountCalendar();

    await waitFor(() => {
      expect(locationSelect(root).value).toBe("8");
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(locationSelect(root).value).toBe("8");
    expect(meetingLocations(root).every((place) => place.includes("San José Insurgentes"))).toBe(true);
    expect(meetingNames(root).some((name) => name.includes("Yoga"))).toBe(true);
  });

  it("filter-bq-location-default por nombre arranca filtrado", async () => {
    const root = mountCalendar({ location: true, locationName: "San José Insurgentes" });

    await waitFor(() => {
      expect(locationSelect(root).value).toBe("8");
      expect(meetingLocations(root).every((place) => place.includes("San José Insurgentes"))).toBe(true);
      expect(meetingNames(root).some((name) => name.includes("Pilates"))).toBe(false);
    });
  });

  it("elige Todos a propósito y no vuelve a la sede de la URL", async () => {
    setSearch("?filter_location=Roma+Norte");
    const root = mountCalendar();

    await waitFor(() => {
      expect(locationSelect(root).value).toBe("1");
    });

    fireEvent.change(locationSelect(root), { target: { value: "" } });

    await waitFor(() => {
      expect(locationSelect(root).value).toBe("");
      const places = meetingLocations(root);
      expect(places.some((place) => place.includes("Roma Norte"))).toBe(true);
      expect(places.some((place) => place.includes("San José Insurgentes"))).toBe(true);
    });
  });
});
