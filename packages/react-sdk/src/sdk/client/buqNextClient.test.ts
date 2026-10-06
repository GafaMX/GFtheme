import { afterEach, describe, expect, it, vi } from "vitest";
import { createGafaSdk } from "../runtime";
import { createBuqNextClient } from "./buqNextClient";
import { NEXT_STUDIO_FIXTURES } from "./buqNextFixtures";
import { indexBuqNextIds } from "./buqNextMap";
import { BUQ_NEXT_UNAVAILABLE_CODE, BUQ_NEXT_UNAVAILABLE_MESSAGE } from "./buqNextUnavailable";

const NOW = new Date("2026-10-06T15:00:00.000Z");
const ids = indexBuqNextIds(NEXT_STUDIO_FIXTURES);

function client() {
  return createBuqNextClient({ companyId: 9001, apiBaseUrl: "https://dev-new.buq.partners/" }, { now: NOW });
}

describe("createBuqNextClient", () => {
  it("pinta la sede Next Studio desde el contrato de fixtures", async () => {
    const next = client();
    const brands = await next.listBrands();
    const locations = await next.listLocations("next-studio");
    const services = await next.listServices("next-studio");
    const staff = await next.listStaff("next-studio");

    expect(brands).toEqual([
      expect.objectContaining({
        id: NEXT_STUDIO_FIXTURES.marca.numericId,
        slug: "next-studio",
        name: "Next Studio",
      }),
    ]);
    expect(locations[0]).toEqual(
      expect.objectContaining({
        id: NEXT_STUDIO_FIXTURES.sede.numericId,
        slug: "next-studio-cdmx",
        name: "Next Studio CDMX",
      }),
    );
    expect(locations[0]?.id).toBe(ids.numericByUuid.get("next-studio-e0f9"));
    expect(services.map((item) => item.name)).toEqual(["Reformer", "Strength", "Yoga Flow"]);
    expect(staff.map((item) => item.name)).toEqual(["María", "Diego", "Ana"]);
  });

  it("lista clases por sede y respeta filtros de servicio, coach y salón", async () => {
    const next = client();
    const all = await next.listMeetings({ locationId: 9201 });
    expect(all.length).toBe(NEXT_STUDIO_FIXTURES.clases.length);
    expect(all[0]?.locationSlug).toBe("next-studio-cdmx");
    expect(all.some((meeting) => meeting.hasSeatMap === true)).toBe(true);
    expect(all.some((meeting) => meeting.hasSeatMap === false)).toBe(true);

    const reformer = await next.listMeetings({ locationId: 9201, serviceId: 9301 });
    expect(reformer.every((meeting) => meeting.serviceName === "Reformer")).toBe(true);
    expect(reformer.length).toBeGreaterThan(0);

    const diego = await next.listMeetings({ locationId: 9201, staffId: 9402 });
    expect(diego.every((meeting) => Number(meeting.staffId) === 9402)).toBe(true);

    const terraza = await next.listMeetings({ locationId: 9201, roomId: 9502 });
    expect(terraza.length).toBeGreaterThan(0);
    expect(terraza.every((meeting) => meeting.hasSeatMap === false)).toBe(true);

    expect(await next.listMeetings({ locationId: 1 })).toEqual([]);
  });

  it("getMeeting resuelve por id numérico del contrato", async () => {
    const found = await client().getMeeting?.({
      meetingId: 9601,
      brandSlug: "next-studio",
      locationSlug: "next-studio-cdmx",
    });
    expect(found?.name).toBe("Reformer");
    expect(found?.staffName).toContain("Mari");
  });

  it("mapea paquetes, membresías y productos (centavos → pesos)", async () => {
    const next = client();
    const combos = await next.listCombos("next-studio");
    const memberships = await next.listMemberships("next-studio");
    const products = await next.listProducts?.("next-studio");

    expect(combos.map((item) => item.name)).toEqual(["5 clases", "10 clases"]);
    expect(combos[0]?.price).toBe(1650);
    expect(combos[0]?.priceLabel).toBe("$1,650 MXN");
    expect(combos[0]?.raw).toEqual(expect.objectContaining({ tipo: "paquete", backend: "buq-next" }));
    expect(memberships[0]).toEqual(expect.objectContaining({ name: "Ilimitada mensual", type: "membership" }));
    expect(products?.map((item) => item.name)).toEqual(["Agua", "Toalla"]);
  });

  it("los métodos de cliente final tiran el error tipado sin romper el resto", async () => {
    const next = client();
    const pending = [
      next.login({ email: "a@b.c", password: "x" }),
      next.getProfile(),
      next.listUserCredits("next-studio"),
      next.createReservation!({
        brandSlug: "next-studio",
        locationSlug: "next-studio-cdmx",
        meetingId: 9601,
        userProfileId: 1,
      }),
      next.reservatePurchase!({
        brandSlug: "next-studio",
        locationSlug: "next-studio-cdmx",
        userId: 1,
        lines: [],
        paymentTypeId: 6,
      }),
    ];

    for (const task of pending) {
      await expect(task).rejects.toMatchObject({
        name: "BuqNextUnavailableError",
        message: BUQ_NEXT_UNAVAILABLE_MESSAGE,
        code: BUQ_NEXT_UNAVAILABLE_CODE,
      });
    }

    expect(() => next.logout()).not.toThrow();
    expect(await next.listBrands()).toHaveLength(1);
  });
});

describe("runtime elige buqNextClient solo con opt-in", () => {
  afterEach(() => {
    window.history.pushState("", document.title, "/");
    document.documentElement.removeAttribute("data-backend");
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("BUQ_ENV=next-dev solo no enciende buqNextClient", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const sdk = createGafaSdk({
      companyId: 1,
      environment: "next-dev",
      analyticsEnabled: false,
    });
    expect(sdk.config.environment).toBe("next-dev");
    expect(sdk.config.apiBaseUrl).toBe("https://dev-new.buq.partners/");
    await sdk.client.listBrands();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("dev-new.buq.partners");
    sdk.unmountAll();
  });

  it("sin opt-in el default sigue siendo el cliente HTTP de gafa.fit", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const sdk = createGafaSdk({
      companyId: 1,
      apiBaseUrl: "https://buq.partners/",
      analyticsEnabled: false,
    });
    await sdk.client.listBrands();
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/brand");
    sdk.unmountAll();
  });

  it("backend: 'buq-next' no pega a gafa.fit", async () => {
    const sdk = createGafaSdk({ companyId: 9001, analyticsEnabled: false }, { backend: "buq-next" });
    const brands = await sdk.client.listBrands();
    expect(brands[0]?.slug).toBe("next-studio");
    sdk.unmountAll();
  });

  it("?backend=buq-next enciende el cliente de fixtures", async () => {
    window.history.pushState("", document.title, "/next.html?backend=buq-next");
    const sdk = createGafaSdk({ companyId: 9001, analyticsEnabled: false });
    expect((await sdk.client.listLocations("next-studio"))[0]?.slug).toBe("next-studio-cdmx");
    sdk.unmountAll();
  });

  it("data-backend=buq-next enciende el cliente de fixtures", async () => {
    document.documentElement.setAttribute("data-backend", "buq-next");
    const sdk = createGafaSdk({ companyId: 9001, analyticsEnabled: false });
    expect((await sdk.client.listStaff("next-studio")).length).toBe(3);
    sdk.unmountAll();
  });
});
