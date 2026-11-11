/**
 * Link del correo de "olvidé mi contraseña".
 *
 * gafa.fit (PostmarkUserResetPassword.php) pega `?token=…&email=…` al
 * `return_url` tal cual: no mira si ya hay `?` o `#`, y no codifica el email.
 *
 * PR #291 ya leía hash / doble `?` / `+` en el email. Seguía fallando cuando:
 *  - el loader público (`gafa-sdk.js`) baja el bundle async (VERSION.txt +
 *    jsDelivr) y Weglot / TranslatePress / un SPA ya reescribieron location
 *  - un redirect HTTP de idioma (`/en/`, `/es/`) se come el `?query`
 *    (el `#` no viaja al server, así que sobrevive)
 *  - `&amp;email=`, TOKEN en mayúsculas, query encoded en el path
 *  - `GAFA_SDK_AUTOSCAN=false` (bootstrap no llamaba openAccount)
 */

export type PasswordResetLink = { token: string; email: string };

export const PASSWORD_RESET_HASH_MARKER = "gafa-pw-reset";
export const PASSWORD_RESET_STORAGE_KEY = "gafa-sdk-password-reset-link";

function paramRe(): RegExp {
  return /([?&#])(token|email)=([^&#?]*)/gi;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeBlob(searchAndHash: string): string {
  let normalized = String(searchAndHash).replace(/&amp;/gi, "&");
  if (/%3[Ff]/i.test(normalized) || /%26(?:amp;)?/i.test(normalized) || /%(?:token|email)/i.test(normalized)) {
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // encoding roto: se parsea tal cual
    }
    normalized = normalized.replace(/&amp;/gi, "&");
  }
  return normalized;
}

/** Lee `token` + `email` de search/hash/href, aunque el link venga mal armado. */
export function parsePasswordResetLink(searchAndHash: string): PasswordResetLink | null {
  const normalized = normalizeBlob(searchAndHash);
  if (!normalized) return null;
  let token = "";
  let email = "";
  // gafa.fit agrega sus params al final: si se repiten, gana el último.
  for (const match of normalized.matchAll(paramRe())) {
    const key = match[2].toLowerCase();
    // `+` es literal: gafa.fit no codifica el email (ana+1@x.com).
    const value = safeDecode(match[3]).trim();
    if (!value) continue;
    if (key === "token") token = value;
    else email = value;
  }
  return token && email ? { token, email } : null;
}

function stripHashMarker(hash: string): string {
  if (!hash) return "";
  const marker = PASSWORD_RESET_HASH_MARKER;
  const cleaned = hash
    .replace(new RegExp(`#${marker}(?=[?&]|$)`), "#")
    .replace(new RegExp(`/${marker}(?=[?&]|$)`), "/")
    .replace(/^#[?&]+/, "#");
  if (cleaned === "#" || cleaned === "#/" || cleaned === "") return "";
  return cleaned;
}

/** Quita `token` / `email` de `search + hash` y deja el resto bien armado. */
export function stripPasswordResetParams(searchAndHash: string): { search: string; hash: string } {
  const normalized = normalizeBlob(searchAndHash);
  const hashAt = normalized.indexOf("#");
  let search = hashAt === -1 ? normalized : normalized.slice(0, hashAt);
  let hash = hashAt === -1 ? "" : normalized.slice(hashAt);

  search = search.replace(paramRe(), "").replace(/^[?&]+/, "");
  search = search ? `?${search}` : "";

  hash = hash.replace(/^#(token|email)=[^&#?]*/i, "#").replace(/([?&])(token|email)=[^&#?]*/gi, "");
  hash = stripHashMarker(hash);

  return { search, hash };
}

function addCandidate(out: string[], value: string | undefined | null): void {
  if (!value || out.includes(value)) return;
  out.push(value);
}

function liveLocationBlobs(): string[] {
  const out: string[] = [];
  if (typeof window === "undefined" || !window.location) return out;
  addCandidate(out, `${window.location.search}${window.location.hash}`);
  addCandidate(out, window.location.href);
  try {
    addCandidate(out, decodeURIComponent(window.location.href));
  } catch {
    // ignore
  }
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav?.name) {
      addCandidate(out, nav.name);
      try {
        addCandidate(out, decodeURIComponent(nav.name));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  try {
    if (window.parent && window.parent !== window) {
      addCandidate(out, `${window.parent.location.search}${window.parent.location.hash}`);
      addCandidate(out, window.parent.location.href);
    }
  } catch {
    // iframe cruzado
  }
  return out;
}

function storedBlob(): string {
  try {
    if (typeof sessionStorage === "undefined") return "";
    return sessionStorage.getItem(PASSWORD_RESET_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function persistBlob(raw: string): void {
  try {
    if (typeof sessionStorage === "undefined" || !raw) return;
    sessionStorage.setItem(PASSWORD_RESET_STORAGE_KEY, raw);
  } catch {
    // Safari privado u origen opaco
  }
}

/**
 * Toma token/email YA — el loader público tarda en bajar el bundle, y el
 * boot espera DOMContentLoaded + Hub. Para entonces Weglot ya reescribió.
 */
export function capturePasswordResetLink(): PasswordResetLink | null {
  const live = liveLocationBlobs();
  for (const blob of live) {
    const parsed = parsePasswordResetLink(blob);
    if (parsed) {
      persistBlob(blob);
      return parsed;
    }
  }
  return parsePasswordResetLink(storedBlob());
}

export function readPasswordResetLink(): PasswordResetLink | null {
  return capturePasswordResetLink() ?? parsePasswordResetLink(storedBlob());
}

export function hasPasswordResetLink(): boolean {
  return readPasswordResetLink() !== null;
}

export function clearPasswordResetLink(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(PASSWORD_RESET_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  if (typeof window === "undefined" || !window.location || !window.history) return;
  const { search, hash } = stripPasswordResetParams(`${window.location.search}${window.location.hash}`);
  try {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${hash}`);
  } catch {
    // ignore
  }
}

/**
 * `return_url` para `/api/password/email`.
 *
 * gafa.fit concatena `?token=&email=` sin mirar. Origin+pathname (query)
 * lo rompe Weglot/TranslatePress/WPML al redirigir `/en/` y tirar el `?`.
 * El `#` no viaja al server: `#gafa-pw-reset` + `?token=` queda
 * `#gafa-pw-reset?token=&email=` y sobrevive el redirect. El parser de
 * #291 ya leía exactamente esa forma (INSIGHT / KIN KIN).
 */
export function passwordResetReturnUrl(
  location: Pick<Location, "origin" | "pathname"> | undefined = typeof window === "undefined"
    ? undefined
    : window.location,
): string {
  if (!location) return "";
  return `${location.origin}${location.pathname}#${PASSWORD_RESET_HASH_MARKER}`;
}

if (typeof window !== "undefined") {
  capturePasswordResetLink();
}
