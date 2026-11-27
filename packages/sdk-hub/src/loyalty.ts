import { utcDay, type NormalizedHubEvent } from "./schema";

export type LoyaltyRule = {
  company_id: number;
  event_name: string;
  points: number;
  daily_cap: number;
  once_per_user: number;
  label?: string | null;
};

export type LoyaltyTier = {
  id: "bronze" | "silver" | "gold";
  label: string;
  min: number;
};

export const LOYALTY_TIERS: LoyaltyTier[] = [
  { id: "gold", label: "Gold", min: 800 },
  { id: "silver", label: "Silver", min: 200 },
  { id: "bronze", label: "Bronze", min: 0 },
];

export function tierForPoints(points: number): LoyaltyTier {
  return LOYALTY_TIERS.find((tier) => points >= tier.min) ?? LOYALTY_TIERS[LOYALTY_TIERS.length - 1]!;
}

export type LoyaltyAward = {
  key: string;
  company_id: number;
  user_id: number;
  event_name: string;
  points: number;
  day: string;
  ts: string;
  props_json: string | null;
};

export function mergeRules(defaults: LoyaltyRule[], company: LoyaltyRule[]): Map<string, LoyaltyRule> {
  const map = new Map<string, LoyaltyRule>();
  for (const rule of defaults) map.set(rule.event_name, rule);
  for (const rule of company) map.set(rule.event_name, rule);
  return map;
}

function propValue(event: NormalizedHubEvent, ...keys: string[]): string | null {
  if (!event.props_json) return null;
  try {
    const props = JSON.parse(event.props_json) as Record<string, unknown>;
    for (const key of keys) {
      const value = props[key];
      if (value != null && value !== "") return String(value);
    }
  } catch {
    return null;
  }
  return null;
}

export function idempotencyKey(event: NormalizedHubEvent): string | null {
  if (event.user_id == null) return null;
  const company = event.company_id;
  const user = event.user_id;
  const day = utcDay(event.ts);

  switch (event.event) {
    case "auth.registered":
      return `c${company}:u${user}:auth.registered`;
    case "auth.login_succeeded":
      return `c${company}:u${user}:auth.login_succeeded:${day}`;
    case "reservation.confirmed":
    case "reservation.waitlisted":
    case "reservation.cancelled": {
      const reservationId = propValue(event, "reservation_id");
      if (reservationId) return `c${company}:${event.event}:${reservationId}`;
      return `c${company}:u${user}:${event.event}:${event.ts}`;
    }
    case "checkout.paid": {
      const purchaseId = propValue(event, "purchase_id", "reservation_id");
      if (purchaseId) return `c${company}:checkout.paid:${purchaseId}`;
      return `c${company}:u${user}:checkout.paid:${event.ts}`;
    }
    default:
      return null;
  }
}

export function planLoyaltyAward(
  event: NormalizedHubEvent,
  rule: LoyaltyRule | undefined,
  state: { exists: boolean; awardedToday: number },
): LoyaltyAward | { skip: string } {
  if (event.user_id == null) return { skip: "no_user" };
  if (!rule || rule.points === 0) return { skip: "no_rule" };
  const key = idempotencyKey(event);
  if (!key) return { skip: "not_scored" };
  if (state.exists) return { skip: "duplicate" };
  if (rule.daily_cap > 0 && state.awardedToday >= rule.daily_cap) return { skip: "daily_cap" };

  return {
    key,
    company_id: event.company_id,
    user_id: event.user_id,
    event_name: event.event,
    points: rule.points,
    day: utcDay(event.ts),
    ts: event.ts,
    props_json: event.props_json,
  };
}

export type LoyaltyStore = {
  loadRules(companyId: number): Promise<{ defaults: LoyaltyRule[]; company: LoyaltyRule[] }>;
  hasKey(key: string): Promise<boolean>;
  awardedToday(companyId: number, userId: number, eventName: string, day: string): Promise<number>;
  writeAward(award: LoyaltyAward): Promise<void>;
};

export async function applyLoyalty(store: LoyaltyStore, events: NormalizedHubEvent[]): Promise<number> {
  let awarded = 0;
  const rulesCache = new Map<number, Map<string, LoyaltyRule>>();

  for (const event of events) {
    if (event.user_id == null) continue;
    let rules = rulesCache.get(event.company_id);
    if (!rules) {
      const loaded = await store.loadRules(event.company_id);
      rules = mergeRules(loaded.defaults, loaded.company);
      rulesCache.set(event.company_id, rules);
    }
    const rule = rules.get(event.event);
    const key = idempotencyKey(event);
    if (!key || !rule) continue;
    const planned = planLoyaltyAward(event, rule, {
      exists: await store.hasKey(key),
      awardedToday: await store.awardedToday(event.company_id, event.user_id, event.event, utcDay(event.ts)),
    });
    if ("skip" in planned) continue;
    await store.writeAward(planned);
    awarded += 1;
  }

  return awarded;
}

export function d1LoyaltyStore(db: D1Database): LoyaltyStore {
  return {
    async loadRules(companyId) {
      const { results } = await db
        .prepare(
          `SELECT company_id, event_name, points, daily_cap, once_per_user, label
           FROM loyalty_rules WHERE company_id IN (0, ?) ORDER BY company_id`,
        )
        .bind(companyId)
        .all<LoyaltyRule>();
      return {
        defaults: results.filter((row) => row.company_id === 0),
        company: results.filter((row) => row.company_id === companyId),
      };
    },
    async hasKey(key) {
      const row = await db
        .prepare("SELECT 1 AS ok FROM loyalty_ledger WHERE idempotency_key = ?")
        .bind(key)
        .first<{ ok: number }>();
      return Boolean(row);
    },
    async awardedToday(companyId, userId, eventName, day) {
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS count FROM loyalty_ledger
           WHERE company_id = ? AND user_id = ? AND event_name = ? AND day = ? AND points > 0`,
        )
        .bind(companyId, userId, eventName, day)
        .first<{ count: number }>();
      return Number(row?.count ?? 0);
    },
    async writeAward(award) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO loyalty_ledger (
              idempotency_key, company_id, user_id, event_name, points, day, ts, props_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            award.key,
            award.company_id,
            award.user_id,
            award.event_name,
            award.points,
            award.day,
            award.ts,
            award.props_json,
          ),
        db
          .prepare(
            `INSERT INTO loyalty_balances (company_id, user_id, points, updated_at)
             VALUES (?, ?, MAX(0, ?), ?)
             ON CONFLICT(company_id, user_id) DO UPDATE SET
               points = MAX(0, loyalty_balances.points + ?),
               updated_at = excluded.updated_at`,
          )
          .bind(award.company_id, award.user_id, award.points, award.ts, award.points),
      ]);
    },
  };
}
