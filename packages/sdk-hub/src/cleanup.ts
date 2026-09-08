const RETENTION_DAYS = 90;
const DELETE_BATCH = 2000;

export async function pruneOldEvents(db: {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<{ meta?: { changes?: number } }>;
    };
  };
}): Promise<{ deleted: number; cutoff: string }> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let deleted = 0;
  for (let i = 0; i < 10; i += 1) {
    const result = await db
      .prepare(`DELETE FROM events WHERE id IN (SELECT id FROM events WHERE ts < ? ORDER BY ts LIMIT ?)`)
      .bind(cutoff, DELETE_BATCH)
      .run();
    const changes = Number(result.meta?.changes ?? 0);
    deleted += changes;
    if (changes < DELETE_BATCH) break;
  }
  return { deleted, cutoff };
}
