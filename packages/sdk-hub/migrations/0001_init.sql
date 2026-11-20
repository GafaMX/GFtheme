CREATE TABLE installations (
  installation_key TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  brand_id INTEGER,
  location_id INTEGER,
  host TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  sdk_version TEXT,
  widgets_json TEXT NOT NULL DEFAULT '[]',
  last_seen_at TEXT NOT NULL
);

CREATE INDEX idx_installations_company ON installations(company_id, last_seen_at);
CREATE INDEX idx_installations_host ON installations(host);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ts TEXT NOT NULL,
  session_id TEXT,
  company_id INTEGER NOT NULL,
  brand_id INTEGER,
  location_id INTEGER,
  user_id INTEGER,
  widget TEXT,
  sdk_version TEXT,
  host TEXT,
  path TEXT,
  props_json TEXT
);

CREATE INDEX idx_events_company_ts ON events(company_id, ts DESC);
CREATE INDEX idx_events_name ON events(name);
CREATE INDEX idx_events_session ON events(session_id);

CREATE TABLE daily_rollups (
  rollup_key TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  company_id INTEGER NOT NULL,
  brand_id INTEGER NOT NULL DEFAULT 0,
  location_id INTEGER NOT NULL DEFAULT 0,
  event_name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_rollups_day_company ON daily_rollups(day, company_id);

CREATE TABLE widgets (
  id TEXT PRIMARY KEY,
  shortcode TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT,
  docs_path TEXT
);

INSERT INTO widgets (id, shortcode, title, status, description, docs_path) VALUES
  ('meetings-calendar', 'meetings-calendar', 'Calendario', 'stable', 'Clases por día o semana, filtros y reserva.', 'docs/v2-hub/widgets.md#calendario'),
  ('combo-list', 'combo-list', 'Paquetes', 'stable', 'Lista de combos / paquetes de créditos.', 'docs/v2-hub/widgets.md#catalogo'),
  ('membership-list', 'membership-list', 'Membresías', 'stable', 'Lista de membresías.', 'docs/v2-hub/widgets.md#catalogo'),
  ('staff-list', 'staff-list', 'Staff', 'stable', 'Lista de coaches.', 'docs/v2-hub/widgets.md#catalogo'),
  ('service-list', 'service-list', 'Servicios', 'stable', 'Lista de servicios.', 'docs/v2-hub/widgets.md#catalogo'),
  ('login', 'login', 'Login', 'stable', 'Formulario de inicio de sesión.', 'docs/v2-hub/widgets.md#auth'),
  ('register', 'register', 'Registro', 'stable', 'Formulario de registro.', 'docs/v2-hub/widgets.md#auth'),
  ('password-recovery', 'password-recovery', 'Recuperar contraseña', 'stable', 'Solicitud de reset.', 'docs/v2-hub/widgets.md#auth'),
  ('login-register', 'login-register', 'Mi cuenta (header)', 'stable', 'Botón de cuenta + carrito en el header.', 'docs/v2-hub/widgets.md#auth'),
  ('login-register-pages', 'login-register-pages', 'Auth en página', 'stable', 'Login / registro inline.', 'docs/v2-hub/widgets.md#auth'),
  ('profile-info', 'profile-info', 'Perfil', 'stable', 'Reservas, créditos, compras.', 'docs/v2-hub/widgets.md#perfil'),
  ('purchase-button', 'purchase-button', 'Botón de compra', 'stable', 'Abre el checkout nativo.', 'docs/v2-hub/widgets.md#compra'),
  ('fancy', 'fancy', 'Host de checkout', 'stable', 'Contenedor legacy; el checkout V2 no lo necesita.', 'docs/v2-hub/widgets.md#compra'),
  ('concierge', 'concierge', 'Concierge', 'preview', 'Asistente (Hueco listo; se instala igual que el calendario).', 'docs/v2-hub/widgets.md#concierge');
