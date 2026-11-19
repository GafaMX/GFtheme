-- Rate limit persistente (por isolate de Workers el Map en memoria se borra).
-- NO aplicar en production hasta un GO explícito. Reutiliza el binding D1 `DB`.

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
