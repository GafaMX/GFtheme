import { describe, expect, it } from "vitest";
import { persistEvents, type D1Like } from "../src/ingest";
import { parseAndNormalizeEvents } from "../src/ingest";

function memoryDb() {
  const sqls: string[] = [];
  const db: D1Like = {
    prepare(query: string) {
      return {
        bind(..._values: unknown[]) {
          return {
            async run() {
              sqls.push(query);
              return {};
            },
            async all() {
              sqls.push(query);
              return { results: [] };
            },
          };
        },
      };
    },
    async batch(statements: unknown[]) {
      sqls.push(`batch:${statements.length}`);
      await Promise.all(
        (statements as Array<{ run?: () => Promise<unknown> }>).map((statement) =>
          statement.run ? statement.run() : Promise.resolve(),
        ),
      );
    },
  };
  return { db, sqls };
}

describe("ingest persist", () => {
  it("escribe evento, rollup e instalacion en un heartbeat", async () => {
    const { db, sqls } = memoryDb();
    const events = parseAndNormalizeEvents(
      {
        event: "sdk.heartbeat",
        company_id: 80,
        host: "fitspin.mx",
        path: "/",
        props: { widgets: ["meetings-calendar"] },
      },
      {},
    );
    const accepted = await persistEvents(db, events);
    expect(accepted).toBe(1);
    expect(sqls.some((sql) => sql.includes("INSERT INTO events"))).toBe(true);
    expect(sqls.some((sql) => sql.includes("daily_rollups"))).toBe(true);
    expect(sqls.some((sql) => sql.includes("installations"))).toBe(true);
  });

  it("un login no crea instalacion", async () => {
    const { db, sqls } = memoryDb();
    await persistEvents(
      db,
      parseAndNormalizeEvents({ event: "auth.login_succeeded", company_id: 1 }, {}),
    );
    expect(sqls.some((sql) => sql.includes("installations"))).toBe(false);
  });
});
