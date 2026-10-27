/** Email: trim + minúsculas. Teléfono: solo dígitos. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("WebCrypto no disponible");
}

export async function hashEmail(value: string | null | undefined): Promise<string | undefined> {
  if (!value || !value.trim()) return undefined;
  return sha256Hex(normalizeEmail(value));
}

export async function hashPhone(value: string | null | undefined): Promise<string | undefined> {
  const digits = value ? normalizePhone(value) : "";
  if (digits.length < 8) return undefined;
  return sha256Hex(digits);
}
