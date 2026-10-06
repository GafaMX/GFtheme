const COOKIE = "sdk_hub_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function encodePayload(payload: { exp: number }): string {
  return btoa(JSON.stringify(payload));
}

function decodePayload(raw: string): { exp: number } | null {
  try {
    const parsed = JSON.parse(atob(raw)) as { exp?: unknown };
    if (typeof parsed.exp !== "number") return null;
    return { exp: parsed.exp };
  } catch {
    return null;
  }
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(sig);
}

export async function issueSessionCookie(secret: string, secure: boolean): Promise<string> {
  const payload = encodePayload({ exp: Date.now() + MAX_AGE_SECONDS * 1000 });
  const sig = await sign(secret, payload);
  const token = `${payload}.${sig}`;
  const parts = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [`${COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(header: string | null, name = COOKIE): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export async function verifySession(secret: string, cookieHeader: string | null): Promise<boolean> {
  const token = readCookie(cookieHeader);
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await sign(secret, payload);
  if (sig.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i += 1) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return false;
  const data = decodePayload(payload);
  if (!data || data.exp < Date.now()) return false;
  return true;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
