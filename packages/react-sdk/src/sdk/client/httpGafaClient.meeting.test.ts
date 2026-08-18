import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function client() {
  return createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 1 });
}

const BRANDS = { data: [{ id: 1, name: "Fitspin", slug: "fitspin" }] };
const LOCATIONS = {
  data: [
    { id: 122, name: "Lomas", slug: "lomas", calendar_days: 7 },
    { id: 235, name: "Polanco", slug: "polanco", calendar_days: 7 },
  ],
};
const MEETING = {
  id: 84213,
  name: "Ride 45",
  meeting_start: "2026-08-20 07:00:00",
  service: { id: 4, name: "Ride" },
  staff: { id: 9, name: "Ana" },
};

function stubApi(routes: Array<[RegExp, unknown]>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = routes.find(([pattern]) => pattern.test(url));
    return jsonResponse(match ? match[1] : []);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("getMeeting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resuelve la clase dentro de la sede indicada", async () => {
    const fetchMock = stubApi([
      [/\/location\?/, LOCATIONS],
      [/\/location\/235\/meetings/, [MEETING]],
    ]);

    const meeting = await client().getMeeting?.({
      meetingId: 84213,
      brandSlug: "fitspin",
      locationSlug: "polanco",
    });

    expect(meeting?.id).toBe(84213);
    expect(meeting?.locationSlug).toBe("polanco");
    // Con marca y sede dadas no hace falta listar las marcas de la compañia.
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/brand"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => /\/location\/122\/meetings/.test(String(url)))).toBe(
      false,
    );
  });

  it("sin marca ni sede, busca en las sedes publicadas de la compañia", async () => {
    stubApi([
      [/\/api\/brand$/, BRANDS],
      [/\/location\?/, LOCATIONS],
      [/\/location\/235\/meetings/, [MEETING]],
    ]);

    const meeting = await client().getMeeting?.({ meetingId: 84213 });

    expect(meeting?.id).toBe(84213);
    expect(meeting?.brandSlug).toBe("fitspin");
  });

  it("devuelve null cuando la clase ya no esta publicada", async () => {
    stubApi([
      [/\/location\?/, LOCATIONS],
      [/meetings/, []],
    ]);

    const meeting = await client().getMeeting?.({ meetingId: 999, brandSlug: "fitspin" });

    expect(meeting).toBeNull();
  });
});
