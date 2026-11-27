/**
 * Los tres backends de Buq. El default del SDK es production (lanzamiento).
 *
 *   production   buq.partners   (gafa.fit)
 *   staging      buq.com.mx     (listo para subir: Stripe nuevo + Laravel)
 *   development  buq.technology
 *
 * Como cambiar:
 *   - data-gf-options: `{ "BUQ_ENV": "staging", ...credenciales }`
 *   - o solo cambia `GAFA_FIT_URL` y las tres URLs de pago se deducen
 *   - o `?buq-env=staging` en la URL (encima de lo que diga el JSON)
 *   - `GAFAPAY_FRONT_URL`, `GAFAPAY_API_URL` y `STRIPE_PAYMENT_SCRIPT_URL`
 *     pisan las URLs de pago del entorno (solo opciones de la página)
 */

export const BUQ_ENVIRONMENT_IDS = ["production", "staging", "development"] as const;
export type BuqEnvironmentId = (typeof BUQ_ENVIRONMENT_IDS)[number];

export type BuqEnvironment = {
  id: BuqEnvironmentId;
  label: string;
  apiBaseUrl: string;
  /** GafaFitSDK v1 (`/sdk/dist/main.js`). El v2 ya no lo necesita. */
  gafaFitSdkUrl: string;
  /** Script legacy de GafaPayFront (Stripe/PayPal). */
  gafaPayFrontUrl: string;
  gafaPayApiUrl: string;
  stripePaymentScriptUrl: string;
  /** Control plane del SDK (ingest + admin). Nunca es el apex de Laravel. */
  hubUrl: string;
};

export const BUQ_ENVIRONMENTS: Record<BuqEnvironmentId, BuqEnvironment> = {
  production: {
    id: "production",
    label: "Production",
    apiBaseUrl: "https://buq.partners/",
    gafaFitSdkUrl: "https://buq.partners/sdk/dist/main.js",
    gafaPayFrontUrl: "https://frontpay.buq.partners/main.js",
    gafaPayApiUrl: "https://apipay.buq.partners",
    stripePaymentScriptUrl: "https://buq.partners/js/payments/stripe-payment.iife.js",
    hubUrl: "https://hub.buq.partners",
  },
  staging: {
    id: "staging",
    label: "Staging",
    apiBaseUrl: "https://buq.com.mx/",
    gafaFitSdkUrl: "https://buq.com.mx/sdk/dist/main.js",
    gafaPayFrontUrl: "https://gafapay-front-dev.azurewebsites.net/prodbuild/main.js",
    gafaPayApiUrl: "https://gafapay-api-gafapay-api-test.azurewebsites.net",
    stripePaymentScriptUrl: "https://buq.com.mx/js/payments/stripe-payment.iife.js",
    hubUrl: "https://hub.buq.com.mx",
  },
  // Conserva los defaults históricos. La guarda impide pagar con ellos en dev:
  // hacen falta overrides seguros de las TRES URLs hasta tener endpoints propios.
  development: {
    id: "development",
    label: "Development",
    apiBaseUrl: "https://buq.technology/",
    gafaFitSdkUrl: "https://buq.technology/sdk/dist/main.js",
    gafaPayFrontUrl: "https://frontpay.buq.partners/main.js",
    gafaPayApiUrl: "https://apipay.buq.partners",
    stripePaymentScriptUrl: "https://buq.partners/js/payments/stripe-payment.iife.js",
    hubUrl: "https://hub.buq.technology",
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

/** Compara el hostname completo y sus subdominios, nunca substrings de una URL. */
export function isProductionBuqHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  return ["buq.partners", "gafa.fit", "gafapay-api.azurewebsites.net", "gafapay-front.azurewebsites.net"].some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

/** Razón de rechazo reutilizada por Laravel, Hub y los tres endpoints de pagos. */
export function nonProductionUrlError(value: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "debe ser una URL absoluta HTTP(S)";
  }
  if (!["https:", "http:"].includes(parsed.protocol)) return "debe usar HTTP(S)";
  if (isProductionBuqHostname(parsed.hostname)) {
    return `apunta a un host de producción (${parsed.hostname.toLowerCase()})`;
  }
  return undefined;
}

export function buqEnvironmentFromApiUrl(apiBaseUrl: string | undefined): BuqEnvironmentId | undefined {
  if (!apiBaseUrl) return undefined;
  try {
    const host = new URL(apiBaseUrl, "https://buq.partners").hostname.toLowerCase();
    if (host === "buq.com.mx" || host.endsWith(".buq.com.mx")) return "staging";
    if (host === "buq.technology" || host.endsWith(".buq.technology")) return "development";
    if (isProductionBuqHostname(host)) {
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

export function withBuqEnvironment<
  T extends { apiBaseUrl?: string; gafaPayFrontUrl?: string; gafaPayApiUrl?: string; stripePaymentScriptUrl?: string; hubUrl?: string; environment?: unknown },
>(input: T, search?: string): T & { apiBaseUrl: string; gafaPayFrontUrl: string; gafaPayApiUrl?: string; stripePaymentScriptUrl?: string; hubUrl: string; environment: BuqEnvironmentId } {
  const env = resolveBuqEnvironment({
    environment: input.environment,
    apiBaseUrl: input.apiBaseUrl,
    search,
  });
  // Solo la query de staging/dev sustituye Laravel. Producción conserva incluso el path.
  const apiBaseUrl = env.id !== "production" && readBuqEnvironmentFromLocation(search)
    ? env.apiBaseUrl : input.apiBaseUrl || env.apiBaseUrl;
  const hubUrl = input.hubUrl || env.hubUrl;
  if (env.id !== "production") {
    for (const [key, value] of Object.entries({ GAFA_FIT_URL: apiBaseUrl, HUB_URL: hubUrl })) {
      const reason = nonProductionUrlError(value);
      if (reason) throw new Error(`[gafa-sdk] Configuración bloqueada (${env.id}): ${key} ${reason}`);
    }
  }
  return {
    ...input,
    environment: env.id,
    apiBaseUrl,
    gafaPayFrontUrl: input.gafaPayFrontUrl || env.gafaPayFrontUrl,
    // En producción ausencia significa “usar la precedencia histórica del bridge”.
    // No materializar defaults: el embed vuelve a parsear esta config al crear el SDK.
    gafaPayApiUrl: input.gafaPayApiUrl || (env.id === "production" ? undefined : env.gafaPayApiUrl),
    stripePaymentScriptUrl: input.stripePaymentScriptUrl || (env.id === "production" ? undefined : env.stripePaymentScriptUrl),
    hubUrl,
  };
}
