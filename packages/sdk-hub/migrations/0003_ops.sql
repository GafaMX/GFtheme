CREATE TABLE IF NOT EXISTS studios (
  company_id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  primary_host TEXT,
  primary_path TEXT,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS people (
  company_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  display_name TEXT,
  last_host TEXT,
  last_seen_at TEXT,
  PRIMARY KEY (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_events_host_ts ON events(host, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_ts ON events(company_id, user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_people_seen ON people(last_seen_at);

INSERT OR IGNORE INTO studios (company_id, display_name, primary_host, primary_path, last_seen_at)
SELECT
  company_id,
  host,
  host,
  path,
  MAX(last_seen_at)
FROM installations
WHERE host NOT IN ('localhost', '127.0.0.1')
GROUP BY company_id;

INSERT OR IGNORE INTO people (company_id, user_id, last_host, last_seen_at)
SELECT company_id, user_id, MAX(host), MAX(ts)
FROM events
WHERE user_id IS NOT NULL AND user_id > 0
GROUP BY company_id, user_id;
