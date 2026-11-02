type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function allowRequest(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}
