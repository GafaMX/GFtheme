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
}

export function clearStoredToken(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
