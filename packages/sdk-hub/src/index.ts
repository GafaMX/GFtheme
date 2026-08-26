import { Hono } from "hono";
import { cors } from "hono/cors";
import { clearSessionCookie, issueSessionCookie, timingSafeEqual, verifySession } from "./auth";
import { parseAndNormalizeEvents, persistEvents } from "./ingest";
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

app.use(
  "/v1/events",
  cors({
    origin: "*",
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

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
  return c.json({ ok: true, accepted });
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
  const given = typeof body.password === "string" ? body.password : "";
  if (!expected || !timingSafeEqual(given, expected)) {
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
