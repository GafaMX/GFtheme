import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { createGafaSdk, type GafaSdk } from "../runtime";
import { createMockGafaClient } from "../client/gafaClient";
import { clearStoredToken } from "../client/tokenStorage";
import type { GafaClient, Meeting } from "../client/types";

const CONFIG = { apiBaseUrl: "https://example.gafa.fit", companyId: 80, publicClientId: "demo-client" };

let sdk: GafaSdk | null = null;

const ALEX_PHOTO =
  "https://buqstorage.blob.core.windows.net/buq-imagenes/public/prod-server/80/applibreriascatalogtablesbrandcatalogstaff/2847/picture_web.jpg";

function meetings(): Meeting[] {
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  const later = new Date(today);
  later.setHours(18, 0, 0, 0);
  const evening = new Date(today);
  evening.setHours(19, 0, 0, 0);
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
      staff: {
        id: 1,
        name: "Alex",
        lastname: "Ruiz",
        photoUrl: ALEX_PHOTO,
      },
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
      staff: { id: 2, name: "Ana", lastname: "Pérez" },
      availability: "available",
      available: 4,
      capacity: 12,
    },
    {
      id: 103,
      name: "Yoga 7pm",
      startsAt: evening.toISOString(),
      brandSlug: "demo-studio",
      service: { id: 12, name: "Yoga" },
      serviceId: 12,
      serviceName: "Yoga",
      location: { id: 1, name: "Roma Norte", slug: "roma-norte", brandSlug: "demo-studio" },
      staff: { id: 2, name: "Ana", lastname: "Pérez" },
      availability: "available",
      available: 5,
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

describe("filtros multiopción de calendario", () => {
  afterEach(() => {
    sdk?.unmountAll();
    sdk = null;
    document.body.innerHTML = "";
    clearStoredToken();
    setSearch("");
  });

  it("permite dejar dos servicios a la vez y no usa <select> nativo", async () => {
    const root = mountCalendar();

    await waitFor(() => {
      expect(root.querySelectorAll(".gafa-meeting-card").length).toBe(3);
    });

    fireEvent.click(root.querySelector('[aria-label="Filtros"]')!);
    const service = root.querySelector('[data-name="service"] .gafa-multiselect__trigger') as HTMLButtonElement;
    fireEvent.click(service);
    const optionByName = (name: string) =>
      Array.from(root.querySelectorAll('[data-name="service"] [role="option"]')).find((option) =>
        option.textContent?.includes(name),
      );
    fireEvent.click(optionByName("Pilates Reformer")!);
    fireEvent.click(optionByName("Barre")!);

    await waitFor(() => {
      const names = Array.from(root.querySelectorAll(".gafa-meeting-name")).map((node) => node.textContent);
      expect(names.some((name) => name?.includes("Pilates Reformer"))).toBe(true);
      expect(names.some((name) => name?.includes("Barre"))).toBe(true);
      expect(names.some((name) => name?.includes("Yoga"))).toBe(false);
    });
    expect(root.querySelector("select.gafa-calendar-filter, .gafa-calendar-filter select")).toBeNull();
    expect(root.querySelector('[data-name="service"] .gafa-multiselect__badge')?.textContent).toBe("2");
  });

  it("filtra por varios coaches y muestra foto si la hay", async () => {
    sdk = createGafaSdk(CONFIG, { client: clientWithServices() });
    const root = document.createElement("div");
    document.body.appendChild(root);
    sdk.mountCalendar(root, { view: "week", allowViewChange: false, filters: { service: true, staff: true } });

    await waitFor(() => {
      expect(root.querySelectorAll(".gafa-meeting-card").length).toBe(3);
    });

    fireEvent.click(root.querySelector('[aria-label="Filtros"]')!);
    fireEvent.click(root.querySelector('[data-name="staff"] .gafa-multiselect__trigger')!);
    const alex = Array.from(root.querySelectorAll('[data-name="staff"] [role="option"]')).find((option) =>
      option.textContent?.includes("Alex"),
    );
    fireEvent.click(alex!);

    await waitFor(() => {
      const names = Array.from(root.querySelectorAll(".gafa-meeting-name")).map((node) => node.textContent);
      expect(names.some((name) => name?.includes("Pilates Reformer"))).toBe(true);
      expect(names.some((name) => name?.includes("Barre"))).toBe(false);
    });

    expect(root.querySelector('[data-name="staff"] .gafa-multiselect__photo')).toBeTruthy();
    expect(
      Array.from(root.querySelectorAll('[data-name="staff"] .gafa-multiselect__initials')).some(
        (node) => node.textContent === "AP",
      ),
    ).toBe(true);
  });
});
