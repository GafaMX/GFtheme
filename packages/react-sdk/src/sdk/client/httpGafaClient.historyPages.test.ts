import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { writeStoredToken, clearStoredToken } from "./tokenStorage";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("listUserReservations: historial paginado", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredToken();
  });

  it("si Laravel pagina reservation-past, recorre las páginas", async () => {
    writeStoredToken("token-de-prueba");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const page = url.searchParams.get("page") ?? "1";
      if (!url.pathname.includes("reservation-past")) return jsonResponse([]);
      if (page === "1") {
        return jsonResponse({
          current_page: 1,
          last_page: 2,
          data: [
            {
              reservations: [{ id: 1, meeting_start: "2026-01-01T12:00:00.000Z", service: { name: "BICI" } }],
              waitlists: [],
            },
          ],
        });
      }
      return jsonResponse({
        current_page: 2,
        last_page: 2,
        data: [
          {
            reservations: [{ id: 2, meeting_start: "2026-01-02T12:00:00.000Z", service: { name: "FUERZA" } }],
            waitlists: [],
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    const rows = await client.listUserReservations("fitspin", "past");

    expect(rows.map((row) => row.id)).toEqual([1, 2]);
    const pastCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("reservation-past"));
    expect(pastCalls).toHaveLength(2);
    expect(String(pastCalls[0][0])).toContain("per_page=50");
  });

  it("si viene un array, un solo GET (no pagina)", async () => {
    writeStoredToken("token-de-prueba");
    const fetchMock = vi.fn(async () =>
      jsonResponse([
        {
          reservations: [{ id: 9, meeting_start: "2026-01-01T12:00:00.000Z", service: { name: "BICI" } }],
          waitlists: [],
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    const rows = await client.listUserReservations("fitspin", "past");
    expect(rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
