import { describe, expect, it } from "vitest";
import { allowPersistentRequest, allowRequest, rateLimitClientIp } from "../src/rateLimit";

describe("rateLimitClientIp", () => {
  it("usa solo cf-connecting-ip y ignora x-forwarded-for", () => {
    expect(
      rateLimitClientIp((name) => (name === "cf-connecting-ip" ? "1.2.3.4" : name === "x-forwarded-for" ? "9.9.9.9" : null)),
    ).toBe("1.2.3.4");
    expect(rateLimitClientIp((name) => (name === "x-forwarded-for" ? "9.9.9.9" : null))).toBe("unknown");
  });
});

describe("rate limit persistente", () => {
  it("sin D1 usa el Map y corta al pasar el tope", () => {
    const key = `test:${Math.random()}`;
    expect(allowRequest(key, 2, 60_000, 1_000)).toBe(true);
    expect(allowRequest(key, 2, 60_000, 1_000)).toBe(true);
    expect(allowRequest(key, 2, 60_000, 1_000)).toBe(false);
    expect(allowRequest(key, 2, 60_000, 70_000)).toBe(true);
  });

  it("allowPersistentRequest sin DB cae al Map", async () => {
    const key = `persist:${Math.random()}`;
    expect(await allowPersistentRequest(undefined, key, 1, 60_000, 1_000)).toBe(true);
    expect(await allowPersistentRequest(undefined, key, 1, 60_000, 1_000)).toBe(false);
  });

  it("si falta la tabla 0009 cae al Map", async () => {
    const db = {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            throw new Error("no such table: rate_limits");
          },
          async run() {
            throw new Error("no such table: rate_limits");
          },
        };
      },
    } as unknown as D1Database;
    const key = `missing:${Math.random()}`;
    expect(await allowPersistentRequest(db, key, 1, 60_000, 1_000)).toBe(true);
    expect(await allowPersistentRequest(db, key, 1, 60_000, 1_000)).toBe(false);
  });

  it("cuenta en D1 y corta al tope", async () => {
    const table = new Map<string, { count: number; reset_at: number }>();
    const db = {
      prepare(sql: string) {
        let binds: unknown[] = [];
        return {
          bind(...args: unknown[]) {
            binds = args;
            return this;
          },
          async first() {
            return table.get(String(binds[0])) ?? null;
          },
          async run() {
            const key = String(binds[0]);
            if (/INSERT/i.test(sql)) {
              table.set(key, { count: 1, reset_at: Number(binds[1]) });
              return;
            }
            const row = table.get(key);
            if (row && row.reset_at === Number(binds[1])) row.count += 1;
          },
        };
      },
    } as unknown as D1Database;
    const key = "ratings:c80:u9";
    expect(await allowPersistentRequest(db, key, 2, 60_000, 1_000)).toBe(true);
    expect(await allowPersistentRequest(db, key, 2, 60_000, 1_000)).toBe(true);
    expect(await allowPersistentRequest(db, key, 2, 60_000, 1_000)).toBe(false);
    expect(table.get(key)?.count).toBe(2);
  });
});
