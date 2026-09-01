import type { Context, Hono } from "hono";
import { collapseSites, groupInstallations, presentPerson, siteHref } from "./directory";
import { buildFunnelSteps } from "./funnel";
import { envFromQuery, hostKind, hostScopeSql, type TrafficEnv } from "./hosts";
import { EVENT_OPTIONS, eventLabel, studioName, widgetLabel } from "./labels";
import { buildLoyaltyOverview } from "./loyaltyOverview";
import { d1LoyaltyStore, mergeRules, tierForPoints, type LoyaltyRule } from "./loyalty";
import { pageMeta, readPage } from "./page";

type AppEnv = {
  Bindings: {
    DB: D1Database;
    ASSETS: Fetcher;
    ADMIN_PASSWORD: string;
    ADMIN_SESSION_SECRET: string;
    ENVIRONMENT: string;
    HUB_PUBLIC_ORIGIN: string;
  };
};

function numQuery(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function like(value: string): string {
  return `%${value.replace(/[%_]/g, "")}%`;
}

function trafficOf(c: Context<AppEnv>): TrafficEnv {
  return envFromQuery(c.req.query("env"));
}

function pushHostScope(clauses: string[], column: string, env: TrafficEnv) {
  const sql = hostScopeSql(column, env);
  if (sql) clauses.push(sql);
}

export function mountAdmin(
  app: Hono<AppEnv>,
  requireAdmin: (c: Context<AppEnv>) => Promise<boolean>,
) {
  app.get("/v1/admin/directory", async (c) => {
    if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
    const installs = await c.env.DB.prepare(
      `SELECT company_id, host, path, last_seen_at FROM installations ORDER BY last_seen_at DESC LIMIT 1000`,
    ).all<{ company_id: number; host: string; path: string; last_seen_at: string }>();
    const people = await c.env.DB.prepare(
      `SELECT company_id, user_id, display_name, email, last_host, last_seen_at
       FROM people ORDER BY last_seen_at DESC LIMIT 400`,
    ).all<{
      company_id: number;
      user_id: number;
      display_name: string | null;
      email: string | null;
      last_host: string | null;
      last_seen_at: string | null;
    }>();
    const env = trafficOf(c);
    const sites = collapseSites(installs.results ?? []).map((site) => ({
      ...site,
      env: hostKind(site.host),
    }));
    return c.json({
      sites: env === "all" ? sites : sites.filter((site) => site.env === env),
      people: (people.results ?? []).map((row) => presentPerson(row)),
      events: EVENT_OPTIONS,
    });
  });

  app.get("/v1/admin/stats", async (c) => {
    if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
    const events = await c.env.DB.prepare(
      `SELECT COUNT(*) AS count, MIN(ts) AS oldest, MAX(ts) AS newest FROM events`,
    ).first<{ count: number; oldest: string | null; newest: string | null }>();
    const sites = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM installations`).first<{ count: number }>();
    const studios = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT company_id) AS count FROM installations`,
    ).first<{ count: number }>();
    const rollups = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT day) AS days, COALESCE(SUM(count), 0) AS total FROM daily_rollups`,
    ).first<{ days: number; total: number }>();
    const people = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM people`).first<{ count: number }>();
    return c.json({
      events: Number(events?.count ?? 0),
      oldest_event: events?.oldest ?? null,
      newest_event: events?.newest ?? null,
      sites: Number(sites?.count ?? 0),
      studios: Number(studios?.count ?? 0),
      people: Number(people?.count ?? 0),
      rollup_days: Number(rollups?.days ?? 0),
      rollup_total: Number(rollups?.total ?? 0),
      retention_days: 90,
      event_bytes_est: Number(events?.count ?? 0) * 400,
      d1_soft_limit_bytes: 10 * 1024 * 1024 * 1024,
    });
  });

  app.get("/v1/admin/installations", async (c) => {
    if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
    const { page, perPage } = readPage(c.req.query());
    const companyId = numQuery(c.req.query("company_id"));
    const host = c.req.query("host")?.trim();
    const q = c.req.query("q")?.trim();
    const clauses = ["1=1"];
    const binds: unknown[] = [];
    if (companyId) {
      clauses.push("company_id = ?");
      binds.push(companyId);
    }
    if (host) {
      clauses.push("host = ?");
      binds.push(host);
    }
    if (q) {
      clauses.push("(host LIKE ? OR path LIKE ?)");
      binds.push(like(q), like(q));
    }
    pushHostScope(clauses, "host", trafficOf(c));
    const where = clauses.join(" AND ");
    const { results } = await c.env.DB.prepare(
      `SELECT installation_key, company_id, brand_id, location_id, host, path,
              sdk_version, widgets_json, last_seen_at
       FROM installations
       WHERE ${where}
       ORDER BY last_seen_at DESC
       LIMIT 1000`,
    )
      .bind(...binds)
      .all();
    const grouped = groupInstallations(
      results.map((row) => {
        const rec = row as { company_id: number; host: string; path: string; last_seen_at: string; widgets_json?: string };
        const widgets = safeJsonArray(rec.widgets_json);
        return {
          company_id: rec.company_id,
          host: rec.host,
          path: rec.path,
          last_seen_at: rec.last_seen_at,
          widgets,
          widget_labels: widgets.map((widget) => widgetLabel(widget)),
        };
      }),
    ).map((group) => ({ ...group, env: hostKind(group.host) }));
    const meta = pageMeta(grouped.length, page, perPage);
    const items = grouped.slice(meta.offset, meta.offset + meta.per_page);
    return c.json({ installations: items, items, ...meta });
  });

  app.get("/v1/admin/events", async (c) => {
    if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
    const { page, perPage } = readPage(c.req.query());
    const companyId = numQuery(c.req.query("company_id"));
    const host = c.req.query("host")?.trim();
    const name = c.req.query("event")?.trim();
    const q = c.req.query("q")?.trim();
    const clauses = ["1=1"];
    const binds: unknown[] = [];
    if (companyId) {
      clauses.push("e.company_id = ?");
      binds.push(companyId);
    }
    if (host) {
      clauses.push("e.host = ?");
      binds.push(host);
    }
    if (name) {
      clauses.push("e.name = ?");
      binds.push(name);
    }
    if (q) {
      clauses.push("(e.host LIKE ? OR e.path LIKE ? OR e.name LIKE ? OR p.display_name LIKE ? OR p.email LIKE ?)");
      binds.push(like(q), like(q), like(q), like(q), like(q));
    }
    pushHostScope(clauses, "e.host", trafficOf(c));
    const where = clauses.join(" AND ");
    const total =
      Number(
        (
          await c.env.DB.prepare(
            `SELECT COUNT(*) AS n FROM events e LEFT JOIN people p ON p.company_id = e.company_id AND p.user_id = e.user_id WHERE ${where}`,
          )
            .bind(...binds)
            .first<{ n: number }>()
        )?.n ?? 0,
      ) || 0;
    const meta = pageMeta(total, page, perPage);
    const { results } = await c.env.DB.prepare(
      `SELECT e.id, e.name, e.ts, e.session_id, e.company_id, e.brand_id, e.location_id, e.user_id,
              e.widget, e.sdk_version, e.host, e.path, e.props_json,
              p.display_name, p.email
       FROM events e
       LEFT JOIN people p ON p.company_id = e.company_id AND p.user_id = e.user_id
       WHERE ${where}
       ORDER BY e.ts DESC
       LIMIT ? OFFSET ?`,
    )
      .bind(...binds, meta.per_page, meta.offset)
      .all();
    const items = results.map((row) => {
      const rec = row as {
        company_id: number;
        user_id: number | null;
        name: string;
        host: string | null;
        path: string | null;
        widget: string | null;
        display_name?: string | null;
        email?: string | null;
      };
      const person = rec.user_id
        ? presentPerson({
            company_id: rec.company_id,
            user_id: rec.user_id,
            display_name: rec.display_name,
            email: rec.email,
            last_host: rec.host,
            path: rec.path,
          })
        : null;
      return {
        ...row,
        studio: studioName(rec.host, rec.path),
        site: siteHref(rec.host, rec.path),
        event_label: eventLabel(rec.name),
        widget_label: rec.widget ? widgetLabel(rec.widget) : null,
        person: person?.name ?? "Visitante",
        person_name: person?.name ?? "Visitante",
        person_email: person?.email ?? null,
      };
    });
    return c.json({ events: items, items, ...meta });
  });

  app.get("/v1/admin/funnel", async (c) => {
    if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
    const days = Math.min(90, Math.max(1, Number(c.req.query("days") ?? 7) || 7));
    const companyId = numQuery(c.req.query("company_id"));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const clauses = ["ts >= ?"];
    const binds: unknown[] = [since];
    if (companyId) {
      clauses.push("company_id = ?");
      binds.push(companyId);
    }
    pushHostScope(clauses, "host", trafficOf(c));
    const { results } = await c.env.DB.prepare(
      `SELECT name AS event_name, COUNT(*) AS count
       FROM events
       WHERE ${clauses.join(" AND ")}
       GROUP BY name
       ORDER BY count DESC`,
    )
      .bind(...binds)
      .all<{ event_name: string; count: number }>();

    const byName = new Map(results.map((row) => [row.event_name, Number(row.count)]));
    const steps = buildFunnelSteps(byName);
    return c.json({
      days,
      since,
      steps,
      totals: Object.fromEntries(byName),
      note: "Cada barra es un conteo independiente, no las mismas personas. Por eso un paso puede ser más alto que el anterior.",
    });
  });

  app.get("/v1/admin/loyalty/overview", async (c) => {
    if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
    const [balances, ledgers, installs] = await Promise.all([
      c.env.DB.prepare(`SELECT company_id, points, updated_at FROM loyalty_balances`).all<{
        company_id: number;
        points: number;
        updated_at: string;
      }>(),
      c.env.DB.prepare(`SELECT company_id, points FROM loyalty_ledger`).all<{ company_id: number; points: number }>(),
      c.env.DB.prepare(`SELECT company_id, host, path, last_seen_at FROM installations`).all<{
        company_id: number;
        host: string;
        path: string;
        last_seen_at: string;
      }>(),
    ]);
    return c.json(
      buildLoyaltyOverview({
        balances: balances.results ?? [],
        ledgers: ledgers.results ?? [],
        sites: installs.results ?? [],
        env: trafficOf(c),
      }),
    );
  });

  app.get("/v1/admin/loyalty/ranking", async (c) => {
    if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
    const { page, perPage } = readPage(c.req.query(), 20);
    const companyId = numQuery(c.req.query("company_id"));
    const q = c.req.query("q")?.trim();
    const clauses = ["1=1"];
    const binds: unknown[] = [];
    if (companyId) {
      clauses.push("b.company_id = ?");
      binds.push(companyId);
    }
    if (q) {
      clauses.push("(p.display_name LIKE ? OR p.email LIKE ?)");
      binds.push(like(q), like(q));
    }
    const where = clauses.join(" AND ");
    const total =
      Number(
        (
          await c.env.DB.prepare(
            `SELECT COUNT(*) AS n
             FROM loyalty_balances b
             LEFT JOIN people p ON p.company_id = b.company_id AND p.user_id = b.user_id
             WHERE ${where}`,
          )
            .bind(...binds)
            .first<{ n: number }>()
        )?.n ?? 0,
      ) || 0;
    const meta = pageMeta(total, page, perPage);
    const { results } = await c.env.DB.prepare(
      `SELECT b.company_id, b.user_id, b.points, b.updated_at, p.display_name, p.email, p.last_host
       FROM loyalty_balances b
       LEFT JOIN people p ON p.company_id = b.company_id AND p.user_id = b.user_id
       WHERE ${where}
       ORDER BY b.points DESC
       LIMIT ? OFFSET ?`,
    )
      .bind(...binds, meta.per_page, meta.offset)
      .all();
    const items = results.map((row) => {
      const rec = row as {
        company_id: number;
        user_id: number;
        points: number;
        updated_at: string;
        display_name?: string | null;
        email?: string | null;
        last_host?: string | null;
      };
      const person = presentPerson({
        company_id: rec.company_id,
        user_id: rec.user_id,
        display_name: rec.display_name,
        email: rec.email,
        last_host: rec.last_host,
        last_seen_at: rec.updated_at,
      });
      return {
        ...person,
        points: rec.points,
        updated_at: rec.updated_at,
        studio: studioName(rec.last_host),
        site: rec.last_host ?? null,
        tier: tierForPoints(Number(rec.points)),
      };
    });
    return c.json({ ranking: items, items, ...meta });
  });

  app.get("/v1/admin/loyalty/ledger", async (c) => {
    if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
    const { page, perPage } = readPage(c.req.query());
    const companyId = numQuery(c.req.query("company_id"));
    const userId = numQuery(c.req.query("user_id"));
    const clauses = ["1=1"];
    const binds: unknown[] = [];
    if (companyId) {
      clauses.push("l.company_id = ?");
      binds.push(companyId);
    }
    if (userId) {
      clauses.push("l.user_id = ?");
      binds.push(userId);
    }
    const where = clauses.join(" AND ");
    const total =
      Number(
        (
          await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM loyalty_ledger l WHERE ${where}`)
            .bind(...binds)
            .first<{ n: number }>()
        )?.n ?? 0,
      ) || 0;
    const meta = pageMeta(total, page, perPage);
    const { results } = await c.env.DB.prepare(
      `SELECT l.idempotency_key, l.company_id, l.user_id, l.event_name, l.points, l.day, l.ts,
              p.display_name, p.email, p.last_host
       FROM loyalty_ledger l
       LEFT JOIN people p ON p.company_id = l.company_id AND p.user_id = l.user_id
       WHERE ${where}
       ORDER BY l.ts DESC
       LIMIT ? OFFSET ?`,
    )
      .bind(...binds, meta.per_page, meta.offset)
      .all();
    const items = results.map((row) => {
      const rec = row as {
        company_id: number;
        user_id: number;
        event_name: string;
        display_name?: string | null;
        email?: string | null;
        last_host?: string | null;
      };
      const person = presentPerson({
        company_id: rec.company_id,
        user_id: rec.user_id,
        display_name: rec.display_name,
        email: rec.email,
        last_host: rec.last_host,
      });
      return {
        ...row,
        event_label: eventLabel(rec.event_name),
        person: person.name,
        person_email: person.email,
        site: rec.last_host ?? null,
        studio: studioName(rec.last_host),
      };
    });
    return c.json({ ledger: items, items, ...meta });
  });

  app.get("/v1/admin/loyalty/rules", async (c) => {
    if (!(await requireAdmin(c))) return c.json({ ok: false }, 401);
    const companyId = numQuery(c.req.query("company_id")) ?? 0;
    const { results } = await c.env.DB.prepare(
      `SELECT company_id, event_name, points, daily_cap, once_per_user, label
       FROM loyalty_rules WHERE company_id IN (0, ?) ORDER BY event_name, company_id`,
    )
      .bind(companyId)
      .all<LoyaltyRule>();
    const defaults = results.filter((row) => row.company_id === 0);
    const company = results.filter((row) => row.company_id === companyId && companyId > 0);
    const effective = [...mergeRules(defaults, company).values()].map((row) => ({
      ...row,
      event_label: eventLabel(row.event_name),
      scope: Number(row.company_id) === 0 ? "Todos los estudios" : "Este estudio",
    }));
    return c.json({ defaults, company, effective });
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
}

function safeJsonArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
