import CryptoJS from "crypto-js";

const STORAGE_KEY = "gafafitSDKAutorization";
// Misma key hardcodeada que usa el SDK legacy (gafa.fit/resources/assets/js/sdk/GafaFitRequests.js).
// No es proteccion real (la key vive en el bundle publico) -- se replica solo para que el
// token sea legible por widgets legacy y por el WebView de buq-app en la misma pagina/sesion.
const ENCRYPTION_KEY = "z9kFLKUk@5SF8FD*J*Lz";

let activeStorageKey = STORAGE_KEY;
let syncLegacy = true;

function hostOf(apiBaseUrl: string): string | null {
  try {
    return new URL(apiBaseUrl, "https://buq.partners").hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isProductionHost(host: string | null): boolean {
  if (!host) return true;
  return (
    host === "buq.partners" ||
    host.endsWith(".buq.partners") ||
    host === "gafa.fit" ||
    host.endsWith(".gafa.fit")
  );
}

/**
 * Staging/dev no deben pisar el token de produccion en el mismo dominio
 * (una pagina de prueba en hybrix.mx contra buq.com.mx no puede desloguear
 * al socio de la home).
 */
export function configureTokenStorage(apiBaseUrl?: string): void {
  const host = apiBaseUrl ? hostOf(apiBaseUrl) : null;
  const production = isProductionHost(host);
  activeStorageKey = production || !host ? STORAGE_KEY : `${STORAGE_KEY}::${host}`;
  syncLegacy = production;
}

export function readStoredToken(): string | null {
  if (typeof localStorage === "undefined") return null;

  const encrypted = localStorage.getItem(activeStorageKey);
  if (!encrypted) return null;

  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    const token = bytes.toString(CryptoJS.enc.Utf8);
    return token || null;
  } catch {
    return null;
  }
}

export function writeStoredToken(token: string): void {
  if (typeof localStorage === "undefined") return;

  const encrypted = CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
  localStorage.setItem(activeStorageKey, encrypted);
  if (syncLegacy) syncLegacySdkToken(token);
  notifyAuthChanged();
}

export function clearStoredToken(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(activeStorageKey);
  if (syncLegacy) syncLegacySdkToken(null);
  notifyAuthChanged();
}

/**
 * El SDK legacy (window.GafaFitSDK) lee el token de localStorage UNA sola vez al
 * cargar y lo cachea en memoria: si el login pasa despues (nuestro caso), su
 * isAuthentified() sigue en false y el checkout dice "necesitas iniciar sesion".
 * setAutorization()/logout() actualizan ese cache interno.
 */
function syncLegacySdkToken(token: string | null): void {
  if (typeof window === "undefined") return;
  const legacy = window.GafaFitSDK as
    | { setAutorization?: (token: string) => void; logout?: () => void }
    | undefined;
  if (!legacy) return;

  try {
    if (token) legacy.setAutorization?.(token);
    else legacy.logout?.();
  } catch {
    // El fallo del SDK legacy no debe romper el flujo propio.
  }
}

// Cada widget se monta en su propio React root, asi que no comparten estado por contexto:
// el login del AuthWidget se avisa al ProfileWidget por un evento de ventana.
const AUTH_CHANGED_EVENT = "gafa-sdk:auth-changed";

function notifyAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function subscribeToAuthChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  window.addEventListener(AUTH_CHANGED_EVENT, listener);
  // `storage` cubre el caso de otra pestana del mismo sitio.
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
