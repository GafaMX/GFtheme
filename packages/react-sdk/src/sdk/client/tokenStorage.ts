import CryptoJS from "crypto-js";

const STORAGE_KEY = "gafafitSDKAutorization";
// Misma key hardcodeada que usa el SDK legacy (gafa.fit/resources/assets/js/sdk/GafaFitRequests.js).
// No es proteccion real (la key vive en el bundle publico) -- se replica solo para que el
// token sea legible por widgets legacy y por el WebView de buq-app en la misma pagina/sesion.
const ENCRYPTION_KEY = "z9kFLKUk@5SF8FD*J*Lz";

export function readStoredToken(): string | null {
  if (typeof localStorage === "undefined") return null;

  const encrypted = localStorage.getItem(STORAGE_KEY);
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
  localStorage.setItem(STORAGE_KEY, encrypted);
  notifyAuthChanged();
}

export function clearStoredToken(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  notifyAuthChanged();
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
