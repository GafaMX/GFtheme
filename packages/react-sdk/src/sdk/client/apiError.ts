/**
 * Mensajes y logs de fallos HTTP del SDK v2.
 *
 * El toast muestra `GafaApiError.message` (AuthWidget, perfil, reserva…).
 * Si el JSON trae `message` o `errors`, se respeta (y se traduce si hay
 * equivalencia corta). Si no, se mapea 401/403/422/5xx/red a español.
 *
 * El diagnóstico va a `console.error("[gafa-sdk] API error", { method, url, status, body })`.
 * El SDK no trae Sentry: si la página host ya cargó `window.Sentry`, se reenvía
 * el mismo payload. Nunca se loguean Authorization, cuerpos de request ni
 * query secrets (token, password, client_secret, …).
 */

export type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

export type FailedApiLog = {
  method: string;
  url: string;
  status: number;
  bodyExcerpt: string;
};

/** El API responde en ingles (o en español muy largo); al usuario se le
    muestran mensajes cortos en español que caben en una linea en movil. */
const API_MESSAGE_TRANSLATIONS: Record<string, string> = {
  "The user credentials were incorrect.": "Correo o contraseña incorrectos.",
  "Estas credenciales no coinciden con nuestros registros.": "Correo o contraseña incorrectos.",
  "El email no concuerda con nuestros registros.": "Este correo no está registrado.",
  "El password no concuerda con nuestros registros.": "La contraseña es incorrecta.",
  "The given data was invalid.": "Revisa los datos ingresados.",
  "The g-recaptcha-response field is required.": "No pudimos validar el captcha. Recarga e inténtalo de nuevo.",
  "The g-recaptcha-response field is required": "No pudimos validar el captcha. Recarga e inténtalo de nuevo.",
  "validation.captcha": "No pudimos validar el captcha. Recarga e inténtalo de nuevo.",
  "The captcha is invalid.": "No pudimos validar el captcha. Recarga e inténtalo de nuevo.",
  "The email has already been taken.": "Ese correo ya está registrado.",
  "The email must be a valid email address.": "Escribe un correo válido.",
  "The password confirmation does not match.": "Las contraseñas no coinciden.",
  "Too Many Attempts.": "Demasiados intentos, espera un poco.",
  "Unauthenticated.": "Tu sesión expiró, entra de nuevo.",
  "Server Error": "Error del servidor, inténtalo de nuevo.",
};

const NETWORK_MESSAGE = "No pudimos conectar. Revisa tu internet e inténtalo de nuevo.";
const UNAUTH_MESSAGE = "Tu sesión expiró, entra de nuevo.";
const FORBIDDEN_MESSAGE = "No tienes permiso para completar esta acción. Recarga e inténtalo de nuevo.";
const VALIDATION_MESSAGE = "Revisa los datos ingresados.";
const SERVER_MESSAGE = "Error del servidor, inténtalo de nuevo.";
const GENERIC_MESSAGE = "No pudimos completar la solicitud. Inténtalo de nuevo.";

const SECRET_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "captcha_secret_key",
  "checkout_token",
  "client_secret",
  "g-recaptcha-response",
  "g_recaptcha_response",
  "key",
  "passwd",
  "password",
  "password_confirmation",
  "refresh_token",
  "secret",
  "token",
]);

type HostSentry = {
  captureException?: (error: unknown, context?: { extra?: Record<string, unknown> }) => void;
};

export function translateApiMessage(message: string): string {
  const trimmed = message.trim();
  const mapped = API_MESSAGE_TRANSLATIONS[trimmed];
  if (mapped) return mapped;
  if (/g-recaptcha-response|recaptcha|captcha_secret_key|\bcaptcha\b/i.test(trimmed)) {
    return "No pudimos validar el captcha. Recarga e inténtalo de nuevo.";
  }
  return trimmed;
}

export function fallbackMessageForStatus(status: number): string {
  if (status === 0) return NETWORK_MESSAGE;
  if (status === 401) return UNAUTH_MESSAGE;
  if (status === 403) return FORBIDDEN_MESSAGE;
  if (status === 422) return VALIDATION_MESSAGE;
  if (status === 429) return "Demasiados intentos, espera un poco.";
  if (status >= 500) return SERVER_MESSAGE;
  if (status >= 400) return GENERIC_MESSAGE;
  return GENERIC_MESSAGE;
}

/**
 * Mensaje para el usuario. Si el server mandó `errors[0]` o `message`, se
 * conserva (traducido si aplica). Si no, se mapea por status.
 */
export function userFacingApiErrorMessage(input: {
  status: number;
  message?: string | null;
  fieldError?: string | null;
}): string {
  const raw = String(input.fieldError ?? input.message ?? "").trim();
  if (raw) return translateApiMessage(raw);
  return fallbackMessageForStatus(input.status);
}

export function firstFieldError(errors?: Record<string, string[]> | null): string | undefined {
  if (!errors) return undefined;
  return Object.values(errors)[0]?.[0];
}

/** PHP a veces imprime un Warning HTML antes del JSON de error. */
export function parseApiErrorPayload(text: string): ApiErrorBody | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const candidates = [trimmed];
  const start = trimmed.search(/[{[]/);
  if (start > 0) candidates.push(trimmed.slice(start));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as ApiErrorBody;
      }
    } catch {
      // siguiente candidato
    }
  }
  return null;
}

export function isSecretQueryKey(key: string): boolean {
  return SECRET_QUERY_KEYS.has(key.toLowerCase());
}

export function redactRequestUrl(raw: string): string {
  try {
    const url = new URL(raw, "https://gafa.invalid");
    const keys = [...url.searchParams.keys()];
    for (const key of keys) {
      if (isSecretQueryKey(key)) url.searchParams.set(key, "[redacted]");
    }
    const redacted = url.toString();
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return redacted;
    return redacted.replace(/^https:\/\/gafa\.invalid/i, "");
  } catch {
    return raw.replace(/([?&](?:access_token|api_key|apikey|auth|authorization|captcha_secret_key|checkout_token|client_secret|g-recaptcha-response|g_recaptcha_response|key|passwd|password|password_confirmation|refresh_token|secret|token)=)[^&]*/gi, "$1[redacted]");
  }
}

const BODY_EXCERPT_LIMIT = 300;

export function responseBodyExcerpt(text: string, max = BODY_EXCERPT_LIMIT): string {
  const collapsed = String(text ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(
      /("?(?:access_token|authorization|captcha_secret_key|client_secret|password|password_confirmation|refresh_token|secret|token)"?\s*[:=]\s*")([^"]*)(")/gi,
      "$1[redacted]$3",
    )
    .replace(/\s+/g, " ")
    .trim();
  return collapsed.slice(0, max);
}

function hostSentry(): HostSentry | undefined {
  if (typeof globalThis === "undefined") return undefined;
  const sentry = (globalThis as { Sentry?: HostSentry }).Sentry;
  return sentry && typeof sentry === "object" ? sentry : undefined;
}

export function logFailedApiCall(entry: FailedApiLog): void {
  const payload = {
    method: entry.method,
    url: redactRequestUrl(entry.url),
    status: entry.status,
    body: responseBodyExcerpt(entry.bodyExcerpt),
  };
  console.error("[gafa-sdk] API error", payload);
  const sentry = hostSentry();
  if (typeof sentry?.captureException !== "function") return;
  try {
    const error = new Error(`${payload.method} ${payload.url} → ${payload.status}`);
    error.name = "GafaSdkApiError";
    sentry.captureException(error, { extra: payload });
  } catch {
    // Sentry del host es opcional
  }
}
