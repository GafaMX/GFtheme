import { Hono } from "hono";
import { cors } from "hono/cors";
import { clearSessionCookie, issueSessionCookie, timingSafeEqual, verifySession } from "./auth";
import { parseAndNormalizeEvents, persistEvents } from "./ingest";
import { applyLoyalty, d1LoyaltyStore, mergeRules, tierForPoints, type LoyaltyRule } from "./loyalty";
import { allowRequest } from "./rateLimit";

export type HubEnv = {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  ADMIN_SESSION_SECRET: string;
  ENVIRONMENT: string;
  HUB_PUBLIC_ORIGIN: string;
};

type AppEnv = { Bindings: HubEnv };

const app = new Hono<AppEnv>();

/**
 * sendBeacon (y algunos fetch del socio) van con credentials:include.
 * ACAO * es ilegal en ese modo; hay que devolver el Origin exacto.
 */
const embedCors = cors({
  origin: (origin) => origin,
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type"],
  credentials: true,
  maxAge: 86400,
});

app.use("/v1/events", embedCors);
app.use("/v1/loyalty/*", embedCors);

app.get("/v1/health", (c) =>
  c.json({
    ok: true,
    service: "sdk-hub",
    environment: c.env.ENVIRONMENT,
    origin: c.env.HUB_PUBLIC_ORIGIN,
  }),
);

app.get("/v1/widgets", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, shortcode, title, status, description, docs_path FROM widgets ORDER BY title",
  ).all();
  return c.json({ widgets: results });
});

app.post("/v1/events", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  if (!allowRequest(`ingest:${ip}`)) {
    return c.json({ ok: false, error: "rate_limited" }, 429);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }

  const referer = c.req.header("referer") ?? c.req.header("origin");
  let requestHost: string | null = null;
  let requestPath: string | null = null;
  if (referer) {
    try {
      const url = new URL(referer);
      requestHost = url.hostname;
      requestPath = url.pathname;
    } catch {
      requestHost = null;
    }
  }

  const events = parseAndNormalizeEvents(body, { host: requestHost, path: requestPath });
  if (events.length === 0) {
    return c.json({ ok: true, accepted: 0 });
  }

  const firstCompany = events[0]?.company_id;
  if (firstCompany != null && !allowRequest(`company:${firstCompany}`, 400)) {
    return c.json({ ok: false, error: "rate_limited" }, 429);
  }

  const accepted = await persistEvents(c.env.DB, events);
  let loyalty = 0;
  try {
    loyalty = await applyLoyalty(d1LoyaltyStore(c.env.DB), events);
  } catch {
    loyalty = 0;
  }
  return c.json({ ok: true, accepted, loyalty_awarded: loyalty });
});

async function requireAdmin(c: { env: HubEnv; req: { header: (name: string) => string | undefined } }) {
  const secret = c.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  return verifySession(secret, c.req.header("cookie") ?? null);
}

app.post("/v1/admin/login", async (c) => {
  let body: { password?: string } = {};
  try {
    body = (await c.req.json()) as { password?: string };
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const expected = c.env.ADMIN_PASSWORD;
  const given = typeof body.password === "string" ? body.password.trim() : "";
  if (!expected) {
    return c.json(
      {
        ok: false,
        error: "missing_admin_password",
        hint: "Copia packages/sdk-hub/.dev.vars.example a .dev.vars y reinicia wrangler.",
      },
      503,
    );
  }
  if (!given || !timingSafeEqual(given, expected)) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }
  const secure = c.env.ENVIRONMENT === "production" || c.env.ENVIRONMENT === "staging";
  const cookie = await issueSessionCookie(c.env.ADMIN_SESSION_SECRET, secure);
  c.header("Set-Cookie", cookie);
  return c.json({ ok: true });
});

app.post("/v1/admin/logout", async (c) => {
  const secure = c.env.ENVIRONMENT === "production" || c.env.ENVIRONMENT === "staging";
  c.header("Set-Cookie", clearSessionCookie(secure));
  return c.json({ ok: true });
});

app.get("/v1/admin/me", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  return c.json({ ok: true, role: "admin" });
});

app.get("/v1/admin/installations", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  const companyId = c.req.query("company_id");
  const brandId = c.req.query("brand_id");
  const locationId = c.req.query("location_id");
  const clauses = ["1=1"];
  const binds: unknown[] = [];
  if (companyId) {
    clauses.push("company_id = ?");
    binds.push(Number(companyId));
  }
  if (brandId) {
    clauses.push("brand_id = ?");
    binds.push(Number(brandId));
  }
  if (locationId) {
    clauses.push("location_id = ?");
    binds.push(Number(locationId));
  }
  const { results } = await c.env.DB.prepare(
    `SELECT installation_key, company_id, brand_id, location_id, host, path,
            sdk_version, widgets_json, last_seen_at
     FROM installations
     WHERE ${clauses.join(" AND ")}
     ORDER BY last_seen_at DESC
     LIMIT 500`,
  )
    .bind(...binds)
    .all();
  return c.json({
    installations: results.map((row) => ({
      ...row,
      widgets: safeJsonArray((row as { widgets_json?: string }).widgets_json),
    })),
  });
});

app.get("/v1/admin/events", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  const companyId = c.req.query("company_id");
  const name = c.req.query("event");
  const clauses = ["1=1"];
  const binds: unknown[] = [];
  if (companyId) {
    clauses.push("company_id = ?");
    binds.push(Number(companyId));
  }
  if (name) {
    clauses.push("name = ?");
    binds.push(name);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, ts, session_id, company_id, brand_id, location_id, user_id,
            widget, sdk_version, host, path, props_json
     FROM events
     WHERE ${clauses.join(" AND ")}
     ORDER BY ts DESC
     LIMIT 200`,
  )
    .bind(...binds)
    .all();
  return c.json({ events: results });
});

app.get("/v1/admin/funnel", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  const days = Math.min(90, Math.max(1, Number(c.req.query("days") ?? 7) || 7));
  const companyId = c.req.query("company_id");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const clauses = ["day >= ?"];
  const binds: unknown[] = [since];
  if (companyId) {
    clauses.push("company_id = ?");
    binds.push(Number(companyId));
  }
  const { results } = await c.env.DB.prepare(
    `SELECT event_name, SUM(count) AS count
     FROM daily_rollups
     WHERE ${clauses.join(" AND ")}
     GROUP BY event_name
     ORDER BY count DESC`,
  )
    .bind(...binds)
    .all<{ event_name: string; count: number }>();

  const byName = new Map(results.map((row) => [row.event_name, Number(row.count)]));
  const steps = [
    { event: "calendar.viewed", label: "Calendario visto" },
    { event: "calendar.meeting_opened", label: "Clase abierta" },
    { event: "auth.login_succeeded", label: "Login" },
    { event: "reservation.confirmed", label: "Reserva" },
    { event: "checkout.paid", label: "Compra" },
  ].map((step) => ({ ...step, count: byName.get(step.event) ?? 0 }));

  return c.json({ days, since, steps, totals: Object.fromEntries(byName) });
});

app.get("/v1/loyalty/balance", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  if (!allowRequest(`loyalty:${ip}`, 60)) {
    return c.json({ ok: false, error: "rate_limited" }, 429);
  }
  const companyId = Number(c.req.query("company_id"));
  const userId = Number(c.req.query("user_id"));
  if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(userId) || userId <= 0) {
    return c.json({ ok: false, error: "missing_ids" }, 400);
  }
  const row = await c.env.DB.prepare(
    "SELECT points, updated_at FROM loyalty_balances WHERE company_id = ? AND user_id = ?",
  )
    .bind(companyId, userId)
    .first<{ points: number; updated_at: string }>();
  const points = Number(row?.points ?? 0);
  const ledger = await c.env.DB.prepare(
    `SELECT event_name, points, ts
     FROM loyalty_ledger
     WHERE company_id = ? AND user_id = ?
     ORDER BY ts DESC
     LIMIT 8`,
  )
    .bind(companyId, userId)
    .all();
  return c.json({
    ok: true,
    company_id: companyId,
    user_id: userId,
    points,
    tier: tierForPoints(points),
    updated_at: row?.updated_at ?? null,
    recent: ledger.results,
  });
});

app.get("/v1/admin/summary", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  const companies = await c.env.DB.prepare(
    `SELECT company_id, COUNT(*) AS installations, MAX(last_seen_at) AS last_seen
     FROM installations GROUP BY company_id ORDER BY last_seen DESC`,
  ).all();
  const events = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM events`).first<{ count: number }>();
  return c.json({
    companies: companies.results,
    event_count: events?.count ?? 0,
  });
});

app.get("/v1/admin/loyalty/rules", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  const companyId = Number(c.req.query("company_id") ?? 0);
  const { results } = await c.env.DB.prepare(
    `SELECT company_id, event_name, points, daily_cap, once_per_user, label
     FROM loyalty_rules WHERE company_id IN (0, ?) ORDER BY event_name, company_id`,
  )
    .bind(Number.isFinite(companyId) ? companyId : 0)
    .all<LoyaltyRule>();
  const defaults = results.filter((row) => row.company_id === 0);
  const company = results.filter((row) => row.company_id === companyId && companyId > 0);
  const effective = [...mergeRules(defaults, company).values()];
  return c.json({ defaults, company, effective });
});

app.put("/v1/admin/loyalty/rules", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  let body: { company_id?: number; rules?: Array<Record<string, unknown>> } = {};
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const companyId = Number(body.company_id);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return c.json({ ok: false, error: "company_required" }, 400);
  }
  const rules = Array.isArray(body.rules) ? body.rules : [];
  await c.env.DB.prepare("DELETE FROM loyalty_rules WHERE company_id = ?").bind(companyId).run();
  for (const rule of rules) {
    const eventName = typeof rule.event_name === "string" ? rule.event_name : "";
    if (!eventName) continue;
    await c.env.DB.prepare(
      `INSERT INTO loyalty_rules (company_id, event_name, points, daily_cap, once_per_user, label)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        companyId,
        eventName,
        Number(rule.points) || 0,
        Number(rule.daily_cap) || 0,
        rule.once_per_user ? 1 : 0,
        typeof rule.label === "string" ? rule.label : null,
      )
      .run();
  }
  return c.json({ ok: true });
});

app.get("/v1/admin/loyalty/ranking", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  const companyId = c.req.query("company_id");
  const clauses = ["1=1"];
  const binds: unknown[] = [];
  if (companyId) {
    clauses.push("company_id = ?");
    binds.push(Number(companyId));
  }
  const { results } = await c.env.DB.prepare(
    `SELECT company_id, user_id, points, updated_at
     FROM loyalty_balances
     WHERE ${clauses.join(" AND ")}
     ORDER BY points DESC
     LIMIT 100`,
  )
    .bind(...binds)
    .all();
  return c.json({
    ranking: results.map((row) => ({
      ...row,
      tier: tierForPoints(Number((row as { points: number }).points)),
    })),
  });
});

app.get("/v1/admin/loyalty/ledger", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  const companyId = c.req.query("company_id");
  const userId = c.req.query("user_id");
  const clauses = ["1=1"];
  const binds: unknown[] = [];
  if (companyId) {
    clauses.push("company_id = ?");
    binds.push(Number(companyId));
  }
  if (userId) {
    clauses.push("user_id = ?");
    binds.push(Number(userId));
  }
  const { results } = await c.env.DB.prepare(
    `SELECT idempotency_key, company_id, user_id, event_name, points, day, ts
     FROM loyalty_ledger
     WHERE ${clauses.join(" AND ")}
     ORDER BY ts DESC
     LIMIT 200`,
  )
    .bind(...binds)
    .all();
  return c.json({ ledger: results });
});

app.post("/v1/admin/loyalty/grant", async (c) => {
  if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
  let body: { company_id?: number; user_id?: number; points?: number; reason?: string } = {};
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const companyId = Number(body.company_id);
  const userId = Number(body.user_id);
  const points = Number(body.points);
  if (!companyId || !userId || !Number.isFinite(points) || points === 0) {
    return c.json({ ok: false, error: "invalid_grant" }, 400);
  }
  const ts = new Date().toISOString();
  const nonce = crypto.randomUUID();
  await d1LoyaltyStore(c.env.DB).writeAward({
    key: `c${companyId}:u${userId}:grant:${ts}:${nonce}`,
    company_id: companyId,
    user_id: userId,
    event_name: "admin.grant",
    points,
    day: ts.slice(0, 10),
    ts,
    props_json: JSON.stringify({ reason: body.reason ?? "manual" }),
  });
  return c.json({ ok: true });
});

app.all("*", async (c) => {
  if (c.req.path.startsWith("/v1/")) {
    return c.json({ ok: false, error: "not_found" }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch(request: Request, env: HubEnv, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
};

function safeJsonArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
