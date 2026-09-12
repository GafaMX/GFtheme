import { deepMerge, isPlainObject } from "./merge";

/** Nunca se piden ni se guardan en el Hub. */
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
  "crossSell",
  "language",
  "apiBaseUrl",
  "companyId",
  "publicClientId",
  "brandId",
  "tokenMovil",
  "captchaPublicKey",
  "environment",
  "gafaPayFrontUrl",
  "hubUrl",
  "analyticsEnabled",
  "showMembershipOptions",
  "images",
  "theme",
] as const;

const SECRET_SET = new Set<string>(REMOTE_CONFIG_SECRET_KEYS);
const ALLOWED_SET = new Set<string>(HUB_REMOTE_CONFIG_KEYS);

export function stripRemoteConfigSecrets<T extends Record<string, unknown>>(input: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_SET.has(key)) continue;
    next[key] = value;
  }
  return next as T;
}

/** Partial que el Hub puede persistir / servir. Secretos fuera. Claves raras fuera. */
export function sanitizeHubRemoteConfig(input: unknown): Record<string, unknown> {
  if (!isPlainObject(input)) return {};
  const stripped = stripRemoteConfigSecrets(input);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(stripped)) {
    if (!ALLOWED_SET.has(key) || value === undefined) continue;
    next[key] = value;
  }
  return next;
}

/**
 * defaults (vacío) → Hub → página → query.
 * La página puede traer secretos; Hub y query no.
 */
export function mergeSdkOptionLayers(input: {
  hub?: unknown;
  page?: unknown;
  query?: unknown;
}): Record<string, unknown> {
  let out: Record<string, unknown> = {};
  if (input.hub != null) out = deepMerge(out, sanitizeHubRemoteConfig(input.hub));
  if (isPlainObject(input.page)) out = deepMerge(out, input.page);
  if (input.query != null) out = deepMerge(out, sanitizeHubRemoteConfig(input.query));
  return out;
}

export type HubRemoteConfigResponse = {
  ok?: boolean;
  company_id?: number;
  config?: Record<string, unknown>;
  updated_at?: string | null;
};

export async function fetchHubRemoteConfig(input: {
  hubUrl: string;
  companyId: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, unknown> | null> {
  const hubUrl = input.hubUrl.replace(/\/+$/, "");
  if (!hubUrl || !Number.isFinite(input.companyId) || input.companyId <= 0) return null;
  const fetchImpl = input.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchImpl) return null;

  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timer =
    controller && input.timeoutMs !== 0
      ? setTimeout(() => controller.abort(), input.timeoutMs ?? 800)
      : null;
  try {
    const response = await fetchImpl(`${hubUrl}/v1/config?company_id=${input.companyId}`, {
      method: "GET",
      credentials: "omit",
      signal: controller?.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as HubRemoteConfigResponse;
    if (!body || body.ok === false) return null;
    return sanitizeHubRemoteConfig(body.config ?? {});
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
