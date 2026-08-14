/**
 * Los tres backends de Buq. El default del SDK es production (lanzamiento).
 *
 *   production   buq.partners   (gafa.fit)
 *   staging      buq.com.mx     (listo para subir: Stripe nuevo + Laravel)
 *   development  buq.technology
 *
 * Como cambiar:
 *   - data-gf-options: `{ "BUQ_ENV": "staging", ...credenciales }`
 *   - o solo cambia `GAFA_FIT_URL` y el resto (GafaPayFront) se deduce
 *   - o `?buq-env=staging` en la URL (encima de lo que diga el JSON)
 *   - `GAFAPAY_FRONT_URL` pisa el front de pagos de ese entorno
 */

export const BUQ_ENVIRONMENT_IDS = ["production", "staging", "development"] as const;
export type BuqEnvironmentId = (typeof BUQ_ENVIRONMENT_IDS)[number];

export type BuqEnvironment = {
  id: BuqEnvironmentId;
  label: string;
  apiBaseUrl: string;
  /** GafaFitSDK v1 (`/sdk/dist/main.js`). El v2 ya no lo necesita. */
  gafaFitSdkUrl: string;
  /**
   * GafaPayFront (Stripe/PayPal). Hoy los tres entornos publican el formulario
   * en frontpay.buq.partners; si staging/dev sacan su propio bundle, se cambia
   * aca o se pisa con GAFAPAY_FRONT_URL.
   */
  gafaPayFrontUrl: string;
};

export const BUQ_ENVIRONMENTS: Record<BuqEnvironmentId, BuqEnvironment> = {
  production: {
    id: "production",
    label: "Production",
    apiBaseUrl: "https://buq.partners/",
    gafaFitSdkUrl: "https://buq.partners/sdk/dist/main.js",
    gafaPayFrontUrl: "https://frontpay.buq.partners/main.js",
  },
  staging: {
    id: "staging",
    label: "Staging",
    apiBaseUrl: "https://buq.com.mx/",
    gafaFitSdkUrl: "https://buq.com.mx/sdk/dist/main.js",
    gafaPayFrontUrl: "https://frontpay.buq.partners/main.js",
  },
  development: {
    id: "development",
    label: "Development",
    apiBaseUrl: "https://buq.technology/",
    gafaFitSdkUrl: "https://buq.technology/sdk/dist/main.js",
    gafaPayFrontUrl: "https://frontpay.buq.partners/main.js",
  },
};

export const DEFAULT_BUQ_ENVIRONMENT: BuqEnvironmentId = "production";

const ENV_ALIASES: Record<string, BuqEnvironmentId> = {
  production: "production",
  prod: "production",
  partners: "production",
  "buq.partners": "production",
  "gafa.fit": "production",
  staging: "staging",
  stage: "staging",
  "com.mx": "staging",
  "buq.com.mx": "staging",
  development: "development",
  dev: "development",
  technology: "development",
  "buq.technology": "development",
};

export function parseBuqEnvironmentId(value: unknown): BuqEnvironmentId | undefined {
  if (typeof value !== "string") return undefined;
  return ENV_ALIASES[value.trim().toLowerCase()];
}

export function buqEnvironmentFromApiUrl(apiBaseUrl: string | undefined): BuqEnvironmentId | undefined {
  if (!apiBaseUrl) return undefined;
  try {
    const host = new URL(apiBaseUrl, "https://buq.partners").hostname.toLowerCase();
    if (host === "buq.com.mx" || host.endsWith(".buq.com.mx")) return "staging";
    if (host === "buq.technology" || host.endsWith(".buq.technology")) return "development";
    if (host === "buq.partners" || host.endsWith(".buq.partners") || host === "gafa.fit" || host.endsWith(".gafa.fit")) {
      return "production";
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function isProductionBuqHost(apiBaseUrl: string | undefined): boolean {
  return buqEnvironmentFromApiUrl(apiBaseUrl) === "production" || !apiBaseUrl;
}

/**
 * Lee `?buq-env=` / `?gafa-env=` para cambiar de backend sin editar el JSON.
 * Util en paginas de prueba (Hybrix lienzo, demo del SDK).
 */
export function readBuqEnvironmentFromLocation(
  search = typeof window !== "undefined" ? window.location.search : "",
): BuqEnvironmentId | undefined {
  const params = new URLSearchParams(search);
  return parseBuqEnvironmentId(params.get("buq-env") ?? params.get("gafa-env") ?? params.get("buq_env"));
}

export function resolveBuqEnvironment(input: {
  environment?: unknown;
  apiBaseUrl?: string;
  search?: string;
}): BuqEnvironment {
  const fromQuery = readBuqEnvironmentFromLocation(input.search);
  const fromField = parseBuqEnvironmentId(input.environment);
  const fromUrl = buqEnvironmentFromApiUrl(input.apiBaseUrl);
  const id = fromQuery ?? fromField ?? fromUrl ?? DEFAULT_BUQ_ENVIRONMENT;
  return BUQ_ENVIRONMENTS[id];
}

export function withBuqEnvironment<T extends { apiBaseUrl?: string; gafaPayFrontUrl?: string; environment?: unknown }>(
  input: T,
  search?: string,
): T & { apiBaseUrl: string; gafaPayFrontUrl: string; environment: BuqEnvironmentId } {
  const env = resolveBuqEnvironment({
    environment: input.environment,
    apiBaseUrl: input.apiBaseUrl,
    search,
  });
  return {
    ...input,
    environment: env.id,
    apiBaseUrl: input.apiBaseUrl || env.apiBaseUrl,
    gafaPayFrontUrl: input.gafaPayFrontUrl || env.gafaPayFrontUrl,
  };
}
