import { useQuery } from "@tanstack/react-query";
import { readStoredToken } from "../client/tokenStorage";

/**
 * QR del torniquete (buq-access → ZKBio) SOLO para las compañías listadas.
 * Hoy: The Base (company 204). Cualquier otra compañía no hace ninguna petición
 * y la cuenta se ve exactamente igual que antes.
 */
export const TURNSTILE_ACCESS_URLS: Readonly<Record<number, string>> = {
  204: "https://buq-access.i-f47.workers.dev",
};

export type TurnstileAccess = {
  modo: "estatico" | "dinamico";
  vigente: boolean;
  fin: string | null;
  /** PNG firmado (caduca en 24 h); null en modo dinámico. */
  png: string | null;
  /** Página "Mi acceso" (sirve también para el modo dinámico). */
  pagina: string;
};

export function turnstileAccessUrl(companyId?: number): string | null {
  return companyId != null ? TURNSTILE_ACCESS_URLS[companyId] ?? null : null;
}

export async function fetchTurnstileAccess(baseUrl: string, token: string): Promise<TurnstileAccess | null> {
  const response = await fetch(`${baseUrl}/qr/sesion`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return (await response.json()) as TurnstileAccess;
}

export function useTurnstileAccess(companyId: number | undefined, profileId: number | string | undefined) {
  const baseUrl = turnstileAccessUrl(companyId);
  return useQuery({
    queryKey: ["turnstile-access", companyId, profileId],
    enabled: Boolean(baseUrl && profileId),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const token = readStoredToken();
      return token && baseUrl ? fetchTurnstileAccess(baseUrl, token) : null;
    },
  });
}
