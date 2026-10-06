export const SDK_BACKEND_IDS = ["gafa", "buq-next"] as const;
export type SdkBackendId = (typeof SDK_BACKEND_IDS)[number];

export const DEFAULT_SDK_BACKEND: SdkBackendId = "gafa";

const BACKEND_ALIASES: Record<string, SdkBackendId> = {
  gafa: "gafa",
  "gafa.fit": "gafa",
  "gafa-fit": "gafa",
  partners: "gafa",
  "buq-next": "buq-next",
  buqnext: "buq-next",
  next: "buq-next",
};

export function parseSdkBackendId(value: unknown): SdkBackendId | undefined {
  if (typeof value !== "string") return undefined;
  return BACKEND_ALIASES[value.trim().toLowerCase()];
}

function readBackendFromSearch(search?: string): SdkBackendId | undefined {
  const params = new URLSearchParams(
    search ?? (typeof window !== "undefined" ? window.location.search : ""),
  );
  return parseSdkBackendId(params.get("backend") ?? params.get("data-backend"));
}

function readBackendFromDocument(documentRef?: Document): SdkBackendId | undefined {
  const doc = documentRef ?? (typeof document !== "undefined" ? document : undefined);
  if (!doc) return undefined;
  const candidates = [
    doc.documentElement.getAttribute("data-backend"),
    doc.body?.getAttribute("data-backend"),
    doc.querySelector("[data-gf-options]")?.getAttribute("data-backend"),
    doc.querySelector("[data-gafa-options]")?.getAttribute("data-backend"),
    doc.querySelector("[data-backend]")?.getAttribute("data-backend"),
  ];
  for (const value of candidates) {
    const parsed = parseSdkBackendId(value);
    if (parsed) return parsed;
  }
  return undefined;
}

/**
 * Elige el cliente de datos. Default `gafa` (httpGafaClient / producción).
 * `buq-next` SOLO si algo lo pide en claro: runtime, `?backend=`,
 * `data-backend="buq-next"` o `BACKEND` / `backend` en data-gf-options.
 * El Hub no puede encenderlo (la clave no está en el catálogo remoto).
 */
export function resolveSdkBackend(input: {
  runtimeBackend?: unknown;
  configBackend?: unknown;
  search?: string;
  documentRef?: Document;
} = {}): SdkBackendId {
  return (
    parseSdkBackendId(input.runtimeBackend) ??
    readBackendFromSearch(input.search) ??
    readBackendFromDocument(input.documentRef) ??
    parseSdkBackendId(input.configBackend) ??
    DEFAULT_SDK_BACKEND
  );
}
