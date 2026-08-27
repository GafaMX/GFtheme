import { describe, expect, it } from "vitest";
import {
  applyLoyalty,
  idempotencyKey,
  mergeRules,
  planLoyaltyAward,
  tierForPoints,
  type LoyaltyRule,
  type LoyaltyStore,
} from "../src/loyalty";
import { parseAndNormalizeEvents } from "../src/ingest";

const loginRule: LoyaltyRule = {
  company_id: 0,
  event_name: "auth.login_succeeded",
  points: 5,
  daily_cap: 1,
  once_per_user: 0,
  label: "Login",
};

function event(raw: Record<string, unknown>) {
  return parseAndNormalizeEvents(raw, {})[0]!;
}

describe("loyalty planner", () => {
  it("no puntúa sin user_id", () => {
    const planned = planLoyaltyAward(event({ event: "auth.login_succeeded", company_id: 80 }), loginRule, {
      exists: false,
      awardedToday: 0,
    });
    expect(planned).toEqual({ skip: "no_user" });
  });

  it("login es 5 pts una vez al día", () => {
    const login = event({ event: "auth.login_succeeded", company_id: 80, user_id: 9, ts: "2026-08-27T12:00:00.000Z" });
    expect(idempotencyKey(login)).toBe("c80:u9:auth.login_succeeded:2026-08-27");
    const first = planLoyaltyAward(login, loginRule, { exists: false, awardedToday: 0 });
    expect("points" in first && first.points).toBe(5);
    expect(planLoyaltyAward(login, loginRule, { exists: true, awardedToday: 1 })).toEqual({ skip: "duplicate" });
    expect(planLoyaltyAward(login, loginRule, { exists: false, awardedToday: 1 })).toEqual({ skip: "daily_cap" });
  });

  it("reserva usa reservation_id como idempotencia", () => {
    const reserved = event({
      event: "reservation.confirmed",
      company_id: 80,
      user_id: 9,
      props: { reservation_id: 441 },
    });
    expect(idempotencyKey(reserved)).toBe("c80:reservation.confirmed:441");
  });

  it("las reglas de la compañía pisan el default", () => {
    const merged = mergeRules(
      [loginRule],
      [{ ...loginRule, company_id: 80, points: 15 }],
    );
    expect(merged.get("auth.login_succeeded")?.points).toBe(15);
  });

  it("niveles por umbral", () => {
    expect(tierForPoints(0).id).toBe("bronze");
    expect(tierForPoints(200).id).toBe("silver");
    expect(tierForPoints(800).id).toBe("gold");
  });

  it("no puntúa heartbeats ni vistas de calendario", () => {
    const heartbeat = event({ event: "sdk.heartbeat", company_id: 80, user_id: 9 });
    const viewed = event({ event: "calendar.viewed", company_id: 80, user_id: 9 });
    expect(idempotencyKey(heartbeat)).toBeNull();
    expect(idempotencyKey(viewed)).toBeNull();
    expect(planLoyaltyAward(heartbeat, loginRule, { exists: false, awardedToday: 0 })).toEqual({ skip: "not_scored" });
  });

  it("cancelación resta puntos", () => {
    const cancel = event({
      event: "reservation.cancelled",
      company_id: 80,
      user_id: 9,
      props: { reservation_id: 441 },
    });
    const rule: LoyaltyRule = {
      company_id: 0,
      event_name: "reservation.cancelled",
      points: -10,
      daily_cap: 20,
      once_per_user: 0,
    };
    const planned = planLoyaltyAward(cancel, rule, { exists: false, awardedToday: 0 });
    expect("points" in planned && planned.points).toBe(-10);
  });

  it("applyLoyalty escribe una sola vez por key", async () => {
    const keys = new Set<string>();
    const written: number[] = [];
    const store: LoyaltyStore = {
      async loadRules() {
        return { defaults: [loginRule], company: [] };
      },
      async hasKey(key) {
        return keys.has(key);
      },
      async awardedToday() {
        return written.length;
      },
      async writeAward(award) {
        keys.add(award.key);
        written.push(award.points);
      },
    };
    const login = event({ event: "auth.login_succeeded", company_id: 80, user_id: 3, ts: "2026-08-27T10:00:00.000Z" });
    expect(await applyLoyalty(store, [login, login])).toBe(1);
    expect(written).toEqual([5]);
  });
});
