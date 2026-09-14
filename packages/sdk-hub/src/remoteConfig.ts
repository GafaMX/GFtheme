/**
 * Partial que el Hub guarda. La fuente de verdad del shape es el Zod del SDK
 * (`packages/react-sdk/src/sdk/config/remoteConfig.ts`). Aquí solo strippeamos
 * secretos y nos quedamos con la allowlist — no resolvemos defaults.
 */

export const REMOTE_CONFIG_SECRET_KEYS = [
  "API_SECRET",
  "clientSecret",
  "CAPTCHA_SECRET_KEY",
  "captchaSecretKey",
] as const;

export const HUB_REMOTE_CONFIG_KEYS = [
  "GAFA_FIT_URL",
  "COMPANY_ID",
  "API_CLIENT",
  "BRAND_ID",
  "TOKENMOVIL",
  "CAPTCHA_PUBLIC_KEY",
  "BUQ_ENV",
  "GAFAPAY_FRONT_URL",
  "HUB_URL",
  "ANALYTICS",
  "SHOW_MEMBERSHIP_OPTIONS",
  "IMAGES",
  "THEME",
  "CONCIERGE",
  "concierge",
  "CROSS_SELL",
  "language",
] as const;

const SECRET_SET = new Set<string>(REMOTE_CONFIG_SECRET_KEYS);
const ALLOWED_SET = new Set<string>(HUB_REMOTE_CONFIG_KEYS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeHubRemoteConfig(input: unknown): Record<string, unknown> {
  if (!isPlainObject(input)) return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_SET.has(key) || !ALLOWED_SET.has(key) || value === undefined) continue;
    next[key] = value;
  }
  return next;
}

export function strippedSecretKeys(input: unknown): string[] {
  if (!isPlainObject(input)) return [];
  return Object.keys(input).filter((key) => SECRET_SET.has(key));
}

export type CompanyConfigRow = {
  company_id: number;
  config_json: string;
  updated_at: string | null;
  updated_by: string | null;
};

export function parseStoredConfig(row: CompanyConfigRow | null | undefined): {
  company_id: number | null;
  config: Record<string, unknown>;
  updated_at: string | null;
  updated_by: string | null;
} {
  if (!row) {
    return { company_id: null, config: {}, updated_at: null, updated_by: null };
  }
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(row.config_json || "{}");
  } catch {
    parsed = {};
  }
  return {
    company_id: row.company_id,
    config: sanitizeHubRemoteConfig(parsed),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

export async function readCompanyConfig(
  db: D1Database,
  companyId: number,
): Promise<ReturnType<typeof parseStoredConfig>> {
  const row = await db
    .prepare("SELECT company_id, config_json, updated_at, updated_by FROM company_configs WHERE company_id = ?")
    .bind(companyId)
    .first<CompanyConfigRow>();
  const parsed = parseStoredConfig(row);
  return { ...parsed, company_id: companyId };
}

export async function writeCompanyConfig(
  db: D1Database,
  input: { companyId: number; config: unknown; updatedBy?: string | null },
): Promise<ReturnType<typeof parseStoredConfig> & { stripped: string[] }> {
  const stripped = strippedSecretKeys(input.config);
  const config = sanitizeHubRemoteConfig(input.config);
  const updatedAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO company_configs (company_id, config_json, updated_at, updated_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(company_id) DO UPDATE SET
         config_json = excluded.config_json,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`,
    )
    .bind(input.companyId, JSON.stringify(config), updatedAt, input.updatedBy ?? null)
    .run();
  return { company_id: input.companyId, config, updated_at: updatedAt, updated_by: input.updatedBy ?? null, stripped };
}
