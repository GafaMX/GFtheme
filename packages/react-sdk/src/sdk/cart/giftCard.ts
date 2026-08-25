import type { GiftCodeResult } from "../client/types";

/** El fancy v1 sustituye este marcador en `urlCheckGiftCode` por el código. */
export const GIFT_CODE_PLACEHOLDER = "_|_";

/** Letras/números fáciles de dictar: sin 0/O, 1/I/L. */
const GIFT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Código autogenerado: corto, no el hex largo de v1. */
export const AUTO_GIFT_CODE_LENGTH = 8;

/** Si el API genera un UUID, lo descartamos y usamos uno corto. */
export const MAX_AUTO_GIFT_CODE_LENGTH = 12;

export const MIN_CUSTOM_GIFT_CODE_LENGTH = 4;

export const GIFT_CODE_CHECK_DEBOUNCE_MS = 400;

const NOT_FOUND_RE = /no (se )?encontr|not found|does not exist|no existe|no query results|couldn't find|could not find/i;
const TAKEN_RE = /ya existe|already exists|en uso|taken|duplicate|ocupado|has already been/i;
const INVALID_RE = /inv[aá]lid|formato|required|too short|m[ií]nimo|minimo|too long/i;

export type GiftCodeAvailabilityStatus = "available" | "taken" | "invalid";

export type GiftCodeAvailability = {
  status: GiftCodeAvailabilityStatus;
  message: string;
};

export function giftCardsEnabledFromUrls(urls: {
  checkGiftCode?: string | null;
  generateGiftCode?: string | null;
}): boolean {
  return Boolean(urls.checkGiftCode?.trim() || urls.generateGiftCode?.trim());
}

export function normalizeGiftCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatGiftCodeDisplay(code: string): string {
  const compact = normalizeGiftCode(code);
  if (compact.length === AUTO_GIFT_CODE_LENGTH) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return compact;
}

export function isPlausibleGiftCode(code: string): boolean {
  const compact = normalizeGiftCode(code);
  return compact.length >= MIN_CUSTOM_GIFT_CODE_LENGTH && compact.length <= 24;
}

export function generateShortGiftCode(rng: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < AUTO_GIFT_CODE_LENGTH; i += 1) {
    const index = Math.floor(rng() * GIFT_CODE_ALPHABET.length);
    out += GIFT_CODE_ALPHABET[Math.min(index, GIFT_CODE_ALPHABET.length - 1)];
  }
  return out;
}

/**
 * Preferimos un código corto. El generate-code de gafa.fit a veces
 * suelta un hex de 26+ caracteres; eso no se dicta en mostrador.
 */
export function preferShortGeneratedCode(serverCode?: string | null): string {
  const compact = serverCode ? normalizeGiftCode(serverCode) : "";
  if (compact.length >= MIN_CUSTOM_GIFT_CODE_LENGTH && compact.length <= MAX_AUTO_GIFT_CODE_LENGTH) {
    return compact;
  }
  return generateShortGiftCode();
}

export function extractGeneratedGiftCode(data: unknown): string | null {
  if (typeof data === "string") {
    const compact = normalizeGiftCode(data);
    return compact || null;
  }
  const record = asRecord(data);
  if (!record) return null;
  const nested = asRecord(record.data);
  const candidates = [record.code, record.gift_code, record.giftCode, record.gift_card_code];
  if (nested) candidates.push(nested.code, nested.gift_code, nested.giftCode);
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const compact = normalizeGiftCode(candidate);
      if (compact) return compact;
    }
  }
  return null;
}

export function buildCheckGiftUrl(input: {
  apiBaseUrl: string;
  brandSlug: string;
  locationSlug: string;
  code: string;
  urlTemplate?: string;
}): URL {
  const compact = normalizeGiftCode(input.code);
  if (!compact) throw new Error("Escribe un código de GiftCard.");

  const base = input.apiBaseUrl.endsWith("/") ? input.apiBaseUrl : `${input.apiBaseUrl}/`;
  const origin = new URL(base).origin;
  const template = input.urlTemplate?.trim();
  let href: string;

  if (template && template.includes(GIFT_CODE_PLACEHOLDER)) {
    href = template.replace(GIFT_CODE_PLACEHOLDER, encodeURIComponent(compact));
  } else if (template && /check-gift-code\/?$/i.test(template)) {
    href = `${template.replace(/\/$/, "")}/${encodeURIComponent(compact)}`;
  } else {
    href = `${origin}/api/brand/${input.brandSlug}/location/${input.locationSlug}/reservation/check-gift-code/${encodeURIComponent(compact)}`;
  }

  return new URL(href, base);
}

export function buildGenerateGiftUrl(input: {
  apiBaseUrl: string;
  brandSlug: string;
  locationSlug: string;
  urlTemplate?: string;
}): URL {
  const base = input.apiBaseUrl.endsWith("/") ? input.apiBaseUrl : `${input.apiBaseUrl}/`;
  const template = input.urlTemplate?.trim();
  const href =
    template ||
    `${new URL(base).origin}/api/brand/${input.brandSlug}/location/${input.locationSlug}/reservation/generate-code`;
  return new URL(href, base);
}

export function looksLikeExistingGiftCard(data: unknown): boolean {
  const gift = unwrapGiftPayload(data);
  if (!gift) return false;
  const id = gift.id;
  const hasId =
    (typeof id === "number" && Number.isFinite(id)) || (typeof id === "string" && id.trim() !== "");
  if (!hasId) return false;
  return (
    typeof gift.code === "string" ||
    gift.balance != null ||
    gift.amount != null ||
    gift.remaining != null ||
    typeof gift.name === "string" ||
    gift.users_profiles_id != null ||
    gift.user_profiles_id != null
  );
}

/**
 * `check-gift-code` del fancy: 200 + objeto gift = el código YA existe.
 * En V1 eso no se canjea en checkout: "Convertir en GiftCard" necesita un
 * código LIBRE. Al pagar, gafa.fit crea la tarjeta; se canjea en el Admin.
 */
export function parseGiftCodeCheckResponse(
  code: string,
  ok: boolean,
  httpStatus: number,
  data: unknown,
): GiftCodeResult {
  const existing = looksLikeExistingGiftCard(data);
  const record = unwrapGiftPayload(data) ?? asRecord(data);
  const balance =
    typeof record?.balance === "number"
      ? record.balance
      : typeof record?.amount === "number"
        ? record.amount
        : typeof record?.remaining === "number"
          ? record.remaining
          : undefined;
  const label = typeof record?.name === "string" ? record.name : undefined;
  return {
    valid: Boolean(ok && existing),
    code: normalizeGiftCode(code) || code,
    httpStatus,
    message: giftCheckErrorMessage(data),
    label: existing ? label : undefined,
    balance: existing ? balance : undefined,
    raw: data ?? undefined,
  };
}

export function giftCodeAvailability(result: GiftCodeResult): GiftCodeAvailability {
  if (looksLikeExistingGiftCard(result.raw) || result.valid) {
    return { status: "taken", message: "este código ya está en uso" };
  }

  const message = (result.message ?? "").trim();
  if (TAKEN_RE.test(message)) {
    return { status: "taken", message: "este código ya está en uso" };
  }

  const status = result.httpStatus ?? 0;
  if (status >= 500) {
    return { status: "invalid", message: "no pudimos validar el código" };
  }
  if (status === 409) {
    return { status: "taken", message: "este código ya está en uso" };
  }
  if (INVALID_RE.test(message) && !NOT_FOUND_RE.test(message)) {
    return { status: "invalid", message: "código no válido" };
  }
  if (status === 422 && !NOT_FOUND_RE.test(message)) {
    return { status: "invalid", message: "código no válido" };
  }

  return { status: "available", message: "código válido" };
}

function giftCheckErrorMessage(data: unknown): string | undefined {
  if (typeof data === "string" && data.trim()) return data.trim();
  const record = asRecord(data);
  if (!record) return undefined;
  const errors = record.errors;
  if (errors && typeof errors === "object") {
    const first = Object.values(errors as Record<string, unknown>)
      .flat()
      .find((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (first) return first;
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
  if (typeof record.error === "string" && record.error.trim()) return record.error.trim();
  return undefined;
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function unwrapGiftPayload(data: unknown): Record<string, unknown> | null {
  const record = asRecord(data);
  if (!record) return null;
  for (const key of ["gift_card", "giftCard", "gift", "data"]) {
    const nested = asRecord(record[key]);
    if (nested && (nested.id != null || nested.code != null || nested.balance != null)) {
      return nested;
    }
  }
  return record;
}
