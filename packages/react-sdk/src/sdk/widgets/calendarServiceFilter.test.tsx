import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { createMockGafaClient } from "../client/gafaClient";
import { clearStoredToken } from "../client/tokenStorage";
import type { GafaClient, Meeting } from "../client/types";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };

let sdk: GafaSdk | null = null;

function meetings(): Meeting[] {
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  const later = new Date(today);
  later.setHours(18, 0, 0, 0);
  return [
    {
      id: 101,
      name: "Reformer 9am",
      startsAt: today.toISOString(),
      brandSlug: "demo-studio",
      service: { id: 10, name: "Pilates Reformer" },
      serviceId: 10,
      serviceName: "Pilates Reformer",
      location: { id: 1, name: "Roma Norte", slug: "roma-norte", brandSlug: "demo-studio" },
      availability: "available",
      available: 6,
      capacity: 12,
    },
    {
      id: 102,
      name: "Barre 6pm",
      startsAt: later.toISOString(),
      brandSlug: "demo-studio",
      service: { id: 11, name: "Barre" },
      serviceId: 11,
      serviceName: "Barre",
      location: { id: 1, name: "Roma Norte", slug: "roma-norte", brandSlug: "demo-studio" },
      availability: "available",
      available: 4,
      capacity: 12,
    },
  ];
}

function clientWithServices(): GafaClient {
  const base = createMockGafaClient();
  return {
    ...base,
    listMeetings: async () => meetings(),
    getMeeting: async ({ meetingId }) => meetings().find((item) => item.id === Number(meetingId)) ?? null,
  };
}

function mountCalendar() {
  sdk = createGafaSdk(CONFIG, { client: clientWithServices() });
  const root = document.createElement("div");
  document.body.appendChild(root);
  sdk.mountCalendar(root, { view: "week", allowViewChange: false, filters: { service: true } });
  return root;
}

function setSearch(search: string) {
  window.history.replaceState({}, "", search ? `/${search}` : "/");
}

describe("filtro de servicio por URL / default", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
    setSearch("");
  });

  it("?filter_service=Pilates+Reformer (v1) deja solo ese servicio", async () => {
    setSearch("?filter_service=Pilates+Reformer");
    const root = mountCalendar();

    await waitFor(() => {
      const names = Array.from(root.querySelectorAll(".gafa-meeting-name")).map((node) => node.textContent);
      expect(names.some((name) => name?.includes("Pilates Reformer"))).toBe(true);
      expect(names.some((name) => name?.includes("Barre"))).toBe(false);
    });
  });

  it("?service=11 filtra por id", async () => {
    setSearch("?service=11");
    const root = mountCalendar();

    await waitFor(() => {
      const names = Array.from(root.querySelectorAll(".gafa-meeting-name")).map((node) => node.textContent);
      expect(names.some((name) => name?.includes("Barre"))).toBe(true);
      expect(names.some((name) => name?.includes("Pilates Reformer"))).toBe(false);
    });
  });

  it("filter-bq-service-default por nombre arranca el calendario filtrado", async () => {
    sdk = createGafaSdk(CONFIG, { client: clientWithServices() });
    const root = document.createElement("section");
    root.setAttribute("data-gf-theme", "meetings-calendar");
    root.setAttribute("filter-bq-service-default", "Barre");
    document.body.appendChild(root);
    sdk.mountCalendar(root, {
      view: "week",
      allowViewChange: false,
      filters: { service: true, serviceName: "Barre" },
    });

    await waitFor(() => {
      const names = Array.from(root.querySelectorAll(".gafa-meeting-name")).map((node) => node.textContent);
      expect(names.some((name) => name?.includes("Barre"))).toBe(true);
      expect(names.some((name) => name?.includes("Pilates Reformer"))).toBe(false);
    });
  });
});
