type Bucket = { count: number; resetAt: number };

/** Solo CF. `x-forwarded-for` se puede falsificar. */
export function rateLimitClientIp(header: (name: string) => string | undefined | null): string {
  const ip = header("cf-connecting-ip");
  return typeof ip === "string" && ip.trim() ? ip.trim() : "unknown";
}

const buckets = new Map<string, Bucket>();

export function allowRequest(key: string, limit = 120, windowMs = 60_000, now = Date.now()): boolean {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

/** Rate limit en D1 (sobrevive al isolate). Si la tabla 0009 no está, cae al Map. */
export async function allowPersistentRequest(
  db: D1Database | undefined,
  key: string,
  limit: number,
  windowMs = 60_000,
  now = Date.now(),
): Promise<boolean> {
  if (!db) return allowRequest(key, limit, windowMs, now);
  try {
    const row = await db
      .prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?")
      .bind(key)
      .first<{ count: number; reset_at: number }>();
    if (!row || Number(row.reset_at) <= now) {
      await db
        .prepare("INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)")
        .bind(key, now + windowMs)
        .run();
      return true;
    }
    if (Number(row.count) >= limit) return false;
    await db
      .prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ? AND reset_at = ?")
      .bind(key, row.reset_at)
      .run();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table/i.test(message)) return allowRequest(key, limit, windowMs, now);
    throw error;
  }
}
