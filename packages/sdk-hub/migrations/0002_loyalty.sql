CREATE TABLE loyalty_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  points INTEGER NOT NULL,
  daily_cap INTEGER NOT NULL DEFAULT 0,
  once_per_user INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  UNIQUE(company_id, event_name)
);

CREATE TABLE loyalty_ledger (
  idempotency_key TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  points INTEGER NOT NULL,
  day TEXT NOT NULL,
  ts TEXT NOT NULL,
  props_json TEXT
);

CREATE INDEX idx_loyalty_ledger_user ON loyalty_ledger(company_id, user_id, ts DESC);
CREATE INDEX idx_loyalty_ledger_day ON loyalty_ledger(company_id, user_id, event_name, day);

CREATE TABLE loyalty_balances (
  company_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, user_id)
);

INSERT INTO loyalty_rules (company_id, event_name, points, daily_cap, once_per_user, label) VALUES
  (0, 'auth.registered', 50, 1, 1, 'Registro'),
  (0, 'auth.login_succeeded', 5, 1, 0, 'Login del día'),
  (0, 'reservation.confirmed', 20, 10, 0, 'Reserva'),
  (0, 'reservation.waitlisted', 5, 10, 0, 'Lista de espera'),
  (0, 'reservation.cancelled', -10, 20, 0, 'Cancelación'),
  (0, 'checkout.paid', 50, 10, 0, 'Compra');
