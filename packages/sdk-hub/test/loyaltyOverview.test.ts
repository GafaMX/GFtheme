import { describe, expect, it } from "vitest";
import { buildLoyaltyOverview } from "../src/loyaltyOverview";

describe("loyalty overview", () => {
  it("arma la vista Buq por estudio, no por persona", () => {
    const overview = buildLoyaltyOverview({
      balances: [
        { company_id: 80, points: 80, updated_at: "2026-09-01T00:00:00Z" },
        { company_id: 80, points: 20, updated_at: "2026-09-01T00:10:00Z" },
        { company_id: 227, points: 25, updated_at: "2026-09-01T00:05:00Z" },
      ],
      ledgers: [
        { company_id: 80, points: 50 },
        { company_id: 80, points: 20 },
        { company_id: 227, points: 25 },
      ],
      sites: [
        { company_id: 80, host: "fitspin.mx", path: "/", name: "Fitspin", last_seen_at: "2026-09-01T00:10:00Z" },
        { company_id: 227, host: "forzaroom.com", path: "/", name: "Forza Room", last_seen_at: "2026-09-01T00:05:00Z" },
      ],
    });
    expect(overview.totals).toMatchObject({ studios: 2, members: 3, points: 125, issued: 95, movements: 3 });
    expect(overview.studios[0]).toMatchObject({ name: "Fitspin", members: 2, points: 100, issued: 70, env: "prod" });
    expect(overview.studios[1]?.name).toBe("Forza Room");
  });

  it("esconde estudios que solo viven en Replit cuando el filtro es producción", () => {
    const overview = buildLoyaltyOverview({
      balances: [
        { company_id: 80, points: 80 },
        { company_id: 9, points: 10 },
      ],
      ledgers: [],
      sites: [
        { company_id: 80, host: "fitspin.mx", path: "/" },
        { company_id: 9, host: "buq-preview.replit.dev", path: "/" },
      ],
      env: "prod",
    });
    expect(overview.studios.map((row) => row.name)).toEqual(["Fitspin"]);
    expect(overview.totals.studios).toBe(1);
  });
});
