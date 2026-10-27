/**
 * Link del correo de "olvidé mi contraseña".
 *
 * gafa.fit arma el link pegando `?token=…&email=…` al `return_url` tal cual
 * (sin ver si ya traía `?` o `#`, y sin codificar el email). Si el socio pidió
 * el correo desde una URL con `#horario` o `?location=…`, el link sale roto:
 *   /reservar#horario?token=T&email=E      (token dentro del hash)
 *   /reservar?location=centro?token=T&email=E  (doble `?`)
 * y `URLSearchParams(location.search)` no ve el token. Aquí se leen esos casos
 * (para los correos que ya salieron) y además se manda un `return_url` limpio
 * (origin + pathname) para que los correos nuevos salgan bien.
 */

export type PasswordResetLink = { token: string; email: string };

const PARAM = /([?&#])(token|email)=([^&#?]*)/g;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Lee `token` + `email` de `search + hash`, aunque el link venga mal armado. */
export function parsePasswordResetLink(searchAndHash: string): PasswordResetLink | null {
  let token = "";
  let email = "";
  // gafa.fit agrega sus params al final: si se repiten, gana el último.
  for (const match of searchAndHash.matchAll(PARAM)) {
    // `+` es literal: gafa.fit no codifica el email (ana+1@x.com).
    const value = safeDecode(match[3]).trim();
    if (!value) continue;
    if (match[2] === "token") token = value;
    else email = value;
  }
  return token && email ? { token, email } : null;
}

/** Quita `token` / `email` de `search + hash` y deja el resto bien armado. */
export function stripPasswordResetParams(searchAndHash: string): { search: string; hash: string } {
  const hashAt = searchAndHash.indexOf("#");
  let search = hashAt === -1 ? searchAndHash : searchAndHash.slice(0, hashAt);
  let hash = hashAt === -1 ? "" : searchAndHash.slice(hashAt);

  search = search.replace(PARAM, "").replace(/^[?&]+/, "");
  search = search ? `?${search}` : "";

  // En el hash el `#` se queda: solo se quitan los params pegados atrás.
  hash = hash.replace(/^#(token|email)=[^&#?]*/, "#").replace(/([?&])(token|email)=[^&#?]*/g, "");
  hash = hash.replace(/^#[?&]+/, "#");
  if (hash === "#") hash = "";

  return { search, hash };
}

function currentSearchAndHash(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.search}${window.location.hash}`;
}

export function readPasswordResetLink(): PasswordResetLink | null {
  return parsePasswordResetLink(currentSearchAndHash());
}

export function hasPasswordResetLink(): boolean {
  return readPasswordResetLink() !== null;
}

export function clearPasswordResetLink(): void {
  if (typeof window === "undefined") return;
  const { search, hash } = stripPasswordResetParams(currentSearchAndHash());
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${hash}`);
}

/**
 * `return_url` para `/api/password/email`: solo origin + pathname. gafa.fit
 * le pega `?token=…` sin revisar, así que no puede traer `?` ni `#`.
 */
export function passwordResetReturnUrl(
  location: Pick<Location, "origin" | "pathname"> | undefined = typeof window === "undefined"
    ? undefined
    : window.location,
): string {
  if (!location) return "";
  return `${location.origin}${location.pathname}`;
}
