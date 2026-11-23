-- Calificaciones de clase y coach. Las guarda el Hub (D1), no gafa.fit.
--
-- NO aplicar en production hasta un GO explícito.
-- Local:  npm run migrate:local
-- Staging (cuando se pida): wrangler d1 migrations apply sdk-hub-staging --env staging --remote
-- Production (solo con GO): wrangler d1 migrations apply sdk-hub --env production --remote
--
-- Infra: reutiliza el binding D1 `DB` que ya tiene el Worker. No hay KV/R2 nuevo.

CREATE TABLE class_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  brand_slug TEXT NOT NULL,
  brand_id INTEGER,
  reservation_id INTEGER NOT NULL,
  meeting_id INTEGER,
  meeting_name TEXT,
  staff_id INTEGER,
  staff_name TEXT,
  user_id INTEGER NOT NULL,
  customer_name TEXT,
  class_stars INTEGER,
  staff_stars INTEGER,
  comment TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(company_id, reservation_id)
);

CREATE INDEX idx_class_ratings_company_created ON class_ratings(company_id, created_at DESC);
CREATE INDEX idx_class_ratings_staff ON class_ratings(company_id, staff_id, created_at DESC);
CREATE INDEX idx_class_ratings_meeting ON class_ratings(company_id, meeting_id, created_at DESC);
CREATE INDEX idx_class_ratings_user ON class_ratings(company_id, user_id, reservation_id);
