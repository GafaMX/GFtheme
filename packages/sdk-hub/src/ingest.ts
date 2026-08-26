import {
  installationKey,
  parseEventBatch,
  rollupKey,
  utcDay,
  widgetsFromHeartbeat,
  type NormalizedHubEvent,
} from "./schema";

export type D1Like = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T = unknown>(): Promise<{ results: T[] }>;
    };
  };
  batch(statements: unknown[]): Promise<unknown>;
};

export function parseAndNormalizeEvents(
  body: unknown,
  request: { host?: string | null; path?: string | null },
): NormalizedHubEvent[] {
  return parseEventBatch(body, request);
}

export async function persistEvents(db: D1Like, events: NormalizedHubEvent[]): Promise<number> {
  if (events.length === 0) return 0;

  const statements: unknown[] = [];

  for (const event of events) {
    statements.push(
      db
        .prepare(
          `INSERT INTO events (
            name, ts, session_id, company_id, brand_id, location_id, user_id,
            widget, sdk_version, host, path, props_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          event.event,
          event.ts,
          event.session_id,
          event.company_id,
          event.brand_id,
          event.location_id,
          event.user_id,
          event.widget,
          event.sdk_version,
          event.host,
          event.path,
          event.props_json,
        ),
    );

    const day = utcDay(event.ts);
    const key = rollupKey({
      day,
      company_id: event.company_id,
      brand_id: event.brand_id,
      location_id: event.location_id,
      event_name: event.event,
    });
    statements.push(
      db
        .prepare(
          `INSERT INTO daily_rollups (rollup_key, day, company_id, brand_id, location_id, event_name, count)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT(rollup_key) DO UPDATE SET count = count + 1`,
        )
        .bind(key, day, event.company_id, event.brand_id ?? 0, event.location_id ?? 0, event.event),
    );

    if (event.event === "sdk.heartbeat" && event.host) {
      const widgets = widgetsFromHeartbeat(event);
      const installKey = installationKey({
        company_id: event.company_id,
        brand_id: event.brand_id,
        location_id: event.location_id,
        host: event.host,
        path: event.path ?? "/",
      });
      statements.push(
        db
          .prepare(
            `INSERT INTO installations (
              installation_key, company_id, brand_id, location_id, host, path,
              sdk_version, widgets_json, last_seen_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(installation_key) DO UPDATE SET
              sdk_version = excluded.sdk_version,
              widgets_json = excluded.widgets_json,
              last_seen_at = excluded.last_seen_at,
              brand_id = excluded.brand_id,
              location_id = excluded.location_id`,
          )
          .bind(
            installKey,
            event.company_id,
            event.brand_id,
            event.location_id,
            event.host,
            event.path ?? "/",
            event.sdk_version,
            JSON.stringify(widgets),
            event.ts,
          ),
      );
    }
  }

  await db.batch(statements);
  return events.length;
}
