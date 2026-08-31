import { Hono } from "hono";
import { cors } from "hono/cors";
import { mountAdmin } from "./admin";
import { clearSessionCookie, issueSessionCookie, timingSafeEqual, verifySession } from "./auth";
import { pruneOldEvents } from "./cleanup";
import { parseAndNormalizeEvents, persistEvents } from "./ingest";
import { applyLoyalty, d1LoyaltyStore, tierForPoints } from "./loyalty";
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

mountAdmin(app, requireAdmin);

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
  async scheduled(_event: ScheduledEvent, env: HubEnv, ctx: ExecutionContext) {
    ctx.waitUntil(pruneOldEvents(env.DB));
  },
};
