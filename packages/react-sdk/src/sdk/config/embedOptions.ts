import { legacyOptionsToConfig, type GafaSdkConfig } from "../config";
import { parseBuqEnvironmentId, withBuqEnvironment } from "./buqEnvironments";
import { fetchHubRemoteConfig, mergeSdkOptionLayers } from "./remoteConfig";

export function readRawOptionsRecord(documentRef: Document = document): Record<string, unknown> {
  const optionsElement =
    documentRef.querySelector("[data-gafa-options]") ?? documentRef.querySelector("[data-gf-options]");
  if (!optionsElement) {
    throw new Error("GFTheme options were not found. Expected a [data-gf-options] JSON script.");
  }
  const json = optionsElement.textContent?.trim();
  if (!json) {
    throw new Error("GFTheme options are empty.");
  }
  const raw = JSON.parse(json) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("GFTheme options must be a JSON object.");
  }
  return raw as Record<string, unknown>;
}

export function queryOptionOverrides(
  search = typeof window !== "undefined" ? window.location.search : "",
): Record<string, unknown> {
  const params = new URLSearchParams(search);
  const query: Record<string, unknown> = {};
  const env = params.get("buq-env") ?? params.get("gafa-env") ?? params.get("buq_env");
  if (env) query.BUQ_ENV = env;
  const hub = params.get("hub-url");
  if (hub) query.HUB_URL = hub;
  return query;
}

export async function readEmbedOptionsFromDom(
  documentRef: Document = document,
  options?: {
    fetchRemote?: boolean;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    search?: string;
  },
): Promise<GafaSdkConfig> {
  const page = readRawOptionsRecord(documentRef);
  const query = queryOptionOverrides(options?.search);
  const preview = mergeSdkOptionLayers({ page, query });
  const resolved = withBuqEnvironment({
    apiBaseUrl: typeof preview.GAFA_FIT_URL === "string" ? preview.GAFA_FIT_URL : undefined,
    hubUrl: typeof preview.HUB_URL === "string" ? preview.HUB_URL : undefined,
    environment: preview.BUQ_ENV,
  });
  const companyId = Number(preview.COMPANY_ID ?? preview.companyId);

  let hub: Record<string, unknown> | null = null;
  if (options?.fetchRemote !== false) {
    hub = await fetchHubRemoteConfig({
      hubUrl: resolved.hubUrl,
      companyId,
      timeoutMs: options?.timeoutMs,
      fetchImpl: options?.fetchImpl,
    });
  }

  const merged = mergeSdkOptionLayers({ hub, page, query });
  if (resolved.environment !== "production") {
    if (parseBuqEnvironmentId(merged.BUQ_ENV) === "production") {
      throw new Error(`[gafa-sdk] Configuración bloqueada (${resolved.environment}): el Hub no puede cambiar BUQ_ENV a producción`);
    }
    // El entorno deducido de la página/query no puede perderse al rellenar
    // opciones con el Hub, aunque la página no haya declarado BUQ_ENV.
    merged.BUQ_ENV = resolved.environment;
  }
  return legacyOptionsToConfig(merged);
}
