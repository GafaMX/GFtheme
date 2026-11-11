import type { CartLineType, DiscountCodeResult } from "../client/types";

/** El fancy v1 sustituye este marcador en `urlCheckDiscountCode` por el código. */
export const DISCOUNT_CODE_PLACEHOLDER = "_|_";

export type DiscountLine = { id: number; type: CartLineType };

export type BuildCheckDiscountUrlInput = {
  apiBaseUrl: string;
  brandSlug: string;
  locationSlug: string;
  code: string;
  /** `users_profiles.id` — último segmento de la ruta, NO el meeting. */
  userProfileId?: string | number;
  /** URL del create-form-template, con `_|_` donde va el código. */
  urlTemplate?: string;
  lines: DiscountLine[];
};

/**
 * El fancy v1 hace GET a `urlCheckDiscountCode.replace("_|_", code)` con
 * `combo` / `membership` / `product` (arrays). El último segmento de la ruta
 * es el perfil del usuario; si se manda el meetingId ahí, Laravel busca un
 * UserProfile que no existe y responde 404 → "Código no válido".
 */
export function buildCheckDiscountUrl(input: BuildCheckDiscountUrlInput): URL {
  const code = input.code.trim();
  if (!code) throw new Error("Escribe un código de descuento.");

  const base = input.apiBaseUrl.endsWith("/") ? input.apiBaseUrl : `${input.apiBaseUrl}/`;
  const template = input.urlTemplate?.trim();
  let href: string;

  if (template && template.includes(DISCOUNT_CODE_PLACEHOLDER)) {
    href = template.replace(DISCOUNT_CODE_PLACEHOLDER, code);
  } else if (input.userProfileId != null && String(input.userProfileId) !== "") {
    const origin = new URL(base);
    href = `${origin.origin}/api/brand/${input.brandSlug}/location/${input.locationSlug}/reservation/check-discount-code/${encodeURIComponent(code)}/${input.userProfileId}`;
  } else if (template) {
    href = template;
  } else {
    throw new Error("No pudimos validar el código. Recarga e intenta de nuevo.");
  }

  const url = new URL(href, base);
  for (const line of input.lines) {
    const key =
      line.type === "combo" ? "combo[]" : line.type === "membership" ? "membership[]" : "product[]";
    url.searchParams.append(key, String(line.id));
  }
  return url;
}

/** Igual que `discountInTotalForDiscountCode` del fancy v1. */
export function discountAmountFromCode(
  discount: Pick<DiscountCodeResult, "discountType" | "discountNumber">,
  subtotal: number,
): number {
  const value = Number(discount.discountNumber);
  if (!Number.isFinite(value) || subtotal <= 0) return 0;
  switch (discount.discountType) {
    case "price":
      return value;
    case "percent":
      return (value * subtotal) / 100;
    default:
      return 0;
  }
}

export function resolveDiscountAmount(result: DiscountCodeResult | null | undefined, subtotal: number): number {
  if (!result?.valid) return 0;
  if (result.discountType && result.discountNumber != null) {
    return Math.max(0, discountAmountFromCode(result, subtotal));
  }
  return Math.max(0, result.discountAmount ?? 0);
}

export function discountCheckErrorMessage(data: unknown): string | undefined {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (!data || typeof data !== "object") return undefined;
  const body = data as { message?: string; errors?: Record<string, string[]> };
  const firstField = body.errors ? Object.values(body.errors).flat().find(Boolean) : undefined;
  if (firstField) return firstField;
  if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  return undefined;
}

export function parseDiscountCheckResponse(code: string, ok: boolean, data: unknown): DiscountCodeResult {
  if (!ok) {
    return { valid: false, code, message: discountCheckErrorMessage(data) ?? "Código no válido" };
  }
  if (typeof data === "string") {
    return { valid: false, code, message: data.trim() || "Código no válido" };
  }
  if (!data || typeof data !== "object") {
    return { valid: false, code, message: "Código no válido" };
  }

  const raw = data as Record<string, unknown>;
  const discountType = typeof raw.discount_type === "string" ? raw.discount_type : undefined;
  const parsedNumber =
    typeof raw.discount_number === "number" ? raw.discount_number : Number(raw.discount_number);
  const discountNumber = Number.isFinite(parsedNumber) ? parsedNumber : undefined;
  const looksLikeCode = raw.id != null && (typeof raw.code === "string" || Boolean(discountType));
  if (!looksLikeCode) {
    return { valid: false, code, message: discountCheckErrorMessage(data) ?? "Código no válido" };
  }

  const label =
    typeof raw.short_description === "string" && raw.short_description
      ? raw.short_description
      : discountType === "percent" && discountNumber != null
        ? `${code} · ${discountNumber}%`
        : code;

  return {
    valid: true,
    code,
    label,
    discountType,
    discountNumber,
    raw,
  };
}
