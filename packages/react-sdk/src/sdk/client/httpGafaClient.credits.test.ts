import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { clearStoredToken, writeStoredToken } from "./tokenStorage";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function creditRow(overrides: Record<string, unknown> = {}) {
  return {
    total: 1,
    expiration_date: "2026-09-19 00:00:00",
    credits_id: 509,
    purchase_items_id: 9001,
    credit: { id: 509, name: "CDMXnew" },
    purchase_item: { id: 9001, item_name: "1 clase" },
    ...overrides,
  };
}

describe("listUserCredits", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearStoredToken();
  });

  async function loadCredits(body: unknown) {
    writeStoredToken("token-de-prueba");
    const fetchMock = vi.fn(async () => jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);
    const client = createHttpGafaClient({ apiBaseUrl: "https://buq.partners", companyId: 80 });
    const credits = await client.listUserCredits("fitspin");
    return { credits, fetchMock };
  }

  it("no colapsa compras del mismo tipo interno: cada purchase_item es un paquete", async () => {
    const { credits } = await loadCredits({
      data: [
        creditRow({ purchase_items_id: 11, purchase_item: { id: 11, item_name: "1 clase" }, expiration_date: "2026-09-17" }),
        creditRow({ purchase_items_id: 12, purchase_item: { id: 12, item_name: "1 clase" }, expiration_date: "2026-09-18" }),
        creditRow({ purchase_items_id: 13, purchase_item: { id: 13, item_name: "1 clase" }, expiration_date: "2026-09-19" }),
        creditRow({
          purchase_items_id: 14,
          purchase_item: { id: 14, item_name: "5 Clases" },
          expiration_date: "2026-10-10",
        }),
      ],
    });

    expect(credits).toHaveLength(4);
    expect(credits.map((c) => c.id)).toEqual([11, 12, 13, 14]);
    expect(credits.every((c) => c.creditTypeId === 509)).toBe(true);
    expect(credits.map((c) => c.name)).toEqual(["1 clase", "1 clase", "1 clase", "5 Clases"]);
    expect(credits.reduce((sum, c) => sum + c.total, 0)).toBe(4);
  });

  it("usa el nombre del paquete comprado, no el tipo interno CDMXnew", async () => {
    const { credits } = await loadCredits({ data: [creditRow()] });
    expect(credits[0].name).toBe("1 clase");
    expect(credits[0].name).not.toBe("CDMXnew");
  });

  it("omite filas sin saldo y pide pagina grande", async () => {
    const { credits, fetchMock } = await loadCredits({
      data: [creditRow({ total: 0 }), creditRow({ purchase_items_id: 22, purchase_item: { item_name: "1 clase" } })],
    });

    expect(credits).toHaveLength(1);
    expect(credits[0].id).toBe(22);
    expect(String(fetchMock.mock.calls[0][0])).toContain("per_page=100");
  });

  it("si falta purchase_items_id, no reusa el id del tipo y las filas siguen siendo distintas", async () => {
    const { credits } = await loadCredits({
      data: [
        creditRow({ purchase_items_id: undefined, purchase_item: { item_name: "1 clase" } }),
        creditRow({ purchase_items_id: undefined, purchase_item: { item_name: "5 Clases" } }),
      ],
    });

    expect(credits).toHaveLength(2);
    expect(new Set(credits.map((c) => c.id)).size).toBe(2);
    expect(credits[0].id).not.toBe(509);
    expect(credits[1].id).not.toBe(509);
  });
});
