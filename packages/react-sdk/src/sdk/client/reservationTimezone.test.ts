import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { writeStoredToken, clearStoredToken } from "./tokenStorage";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("zona horaria de las reservas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredToken();
  });

  it("toma la zona de la marca: Cancún no se pinta en hora de CDMX", async () => {
    writeStoredToken("token-de-prueba");

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/brand?") || url.endsWith("/api/brand")) {
        return jsonResponse({
          data: [
            {
              id: 125,
              name: "Fitspin Cancún",
              slug: "fitspin-cancun",
              time_zone: "America/Cancun",
              pic: "https://cdn.example/fitspin.png",
            },
            { id: 86, name: "Fitspin Cdmx", slug: "fitspin", time_zone: "America/Mexico_City" },
          ],
        });
      }
      return jsonResponse([
        {
          reservations: [
            {
              id: 1,
              meeting_start: "2026-08-20T23:15:00.000000Z",
              meetings: { service: { name: "Fuerza PM" } },
              location: { name: "Cancún" },
            },
          ],
        },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    const brands = await client.listBrands();
    expect(brands.find((brand) => brand.slug === "fitspin-cancun")?.logoUrl).toBe(
      "https://cdn.example/fitspin.png",
    );
    const reservations = await client.listUserReservations("fitspin-cancun");

    expect(reservations[0].timezone).toBe("America/Cancun");
    expect(
      new Date(reservations[0].startsAt).toLocaleTimeString("es-MX", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: reservations[0].timezone,
      }),
    ).toContain("6:15");
  });

  it("usa la zona de la marca de reservation-future antes que la del catálogo", async () => {
    writeStoredToken("token-de-prueba");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/brand") {
        return jsonResponse([{ id: 125, slug: "fitspin-cancun", time_zone: "America/Mexico_City" }]);
      }
      expect(url.pathname).toBe("/api/me/brand/fitspin-cancun/reservation-future");
      expect(url.searchParams.get("reducePopulation")).toBe("true");
      const row = {
        meeting_start: "2026-11-25T01:30:00Z",
        brand: { slug: "fitspin-cancun", time_zone: "America/Cancun" },
      };
      return jsonResponse({ reservations: [
        { ...row, id: 3 },
        { ...row, id: 4, timezone: "America/Tijuana" },
      ] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpGafaClient({ apiBaseUrl: "https://example.test", companyId: 80 });
    await client.listBrands();
    const reservations = await client.listUserReservations("fitspin-cancun", "future");
    expect(reservations.map(({ timezone }) => timezone)).toEqual(["America/Cancun", "America/Tijuana"]);
  });

  it("respeta la zona que ya venga en la reserva", async () => {
    writeStoredToken("token-de-prueba");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          {
            reservations: [
              {
                id: 2,
                meeting_start: "2026-08-20T23:15:00.000000Z",
                timezone: "America/Cancun",
                location: { name: "Cancún" },
              },
            ],
          },
        ]),
      ),
    );

    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    const reservations = await client.listUserReservations("fitspin");

    expect(reservations[0].timezone).toBe("America/Cancun");
  });
});
