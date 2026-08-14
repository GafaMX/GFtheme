import { z } from "zod";
import type { GafaBrandTheme } from "./theme/theme";
import { withBuqEnvironment, type BuqEnvironmentId } from "./config/buqEnvironments";

/**
 * Par de llaves reCAPTCHA v3 COMPARTIDO de Buq/gafa.fit. El backend valida el
 * captcha con la secret key que el cliente le manda (App\Rules\Captcha), y todo
 * el ecosistema legacy usa este mismo par. Se ponen como default para que el
 * captcha "funcione solo" en cualquier integracion: nadie tiene que configurarlo
 * salvo que un socio quiera su propio par.
 */
export const DEFAULT_CAPTCHA_PUBLIC_KEY = "6LcGcsEUAAAAAJWbE6HqaOHQAwzAhjbifExQx3e8";
export const DEFAULT_CAPTCHA_SECRET_KEY = "6LcGcsEUAAAAAOQCOt68hLjGsYHuELQZFheZtgbn";

/**
 * Miniaturas de las imagenes que suben las marcas. Por default se piden a la
 * misma zona de Cloudflare donde vive la API (ver `images/imageProxy.ts`); si la
 * zona no tiene Transformations activado, el SDK lo detecta solo y sigue
 * funcionando sin miniaturas.
 */
const imagesSchema = z
  .object({
    provider: z.enum(["cloudflare", "none"]).optional(),
    transformBaseUrl: z.string().optional(),
    allowUnoptimizedOriginals: z.boolean().optional(),
  })
  .optional();

const legacyThemeSchema = z
  .object({
    preset: z.string().optional(),
    logoUrl: z.string().optional(),
    colors: z.record(z.string(), z.string()).optional(),
    typography: z
      .object({
        fontFamily: z.string().optional(),
        headingFontFamily: z.string().optional(),
      })
      .optional(),
    radius: z.record(z.string(), z.string()).optional(),
    assets: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()
  .optional();

export const sdkConfigSchema = z
  .object({
    apiBaseUrl: z.string().optional(),
    companyId: z.union([z.string(), z.number()]).transform(Number),
    publicClientId: z.union([z.string(), z.number()]).optional(),
    // OAuth2 password-grant client secret. Se envia desde el navegador porque asi lo exige
    // hoy la API de gafa.fit (mismo patron ya usado por el theme legacy) -- no es un cambio
    // de postura de seguridad de este SDK, es el contrato existente.
    clientSecret: z.string().optional(),
    brandId: z.union([z.string(), z.number()]).transform(Number).optional(),
    tokenMovil: z.string().nullable().optional(),
    captchaProvider: z.enum(["recaptcha-v3", "turnstile"]).default("recaptcha-v3"),
    // Default al par compartido de Buq: el captcha queda operativo sin que la
    // integracion configure nada. Un socio puede sobreescribirlo con su propio par.
    captchaPublicKey: z.string().default(DEFAULT_CAPTCHA_PUBLIC_KEY),
    // Igual que clientSecret: gafa.fit valida el reCAPTCHA en el server usando esta secret key
    // que el cliente le manda en cada registro (ver App\Rules\Captcha). Viene asi del backend.
    captchaSecretKey: z.string().default(DEFAULT_CAPTCHA_SECRET_KEY),
    language: z.enum(["es", "en"]).default("es"),
    /**
     * Backend de Buq. Default production. `staging` = buq.com.mx (Stripe nuevo),
     * `development` = buq.technology. Tambien se puede poner solo `GAFA_FIT_URL`.
     */
    environment: z.string().optional(),
    /** Script de GafaPayFront (Stripe/PayPal). Default: el del entorno. */
    gafaPayFrontUrl: z.string().optional(),
    images: imagesSchema,
    theme: legacyThemeSchema,
  })
  .passthrough();

export type GafaSdkConfig = z.infer<typeof sdkConfigSchema> & {
  theme?: GafaBrandTheme;
  environment: BuqEnvironmentId;
  apiBaseUrl: string;
  gafaPayFrontUrl: string;
};

const legacyOptionsSchema = z
  .object({
    GAFA_FIT_URL: z.string().optional(),
    COMPANY_ID: z.union([z.string(), z.number()]),
    API_CLIENT: z.union([z.string(), z.number()]).optional(),
    API_SECRET: z.string().optional(),
    BRAND_ID: z.union([z.string(), z.number()]).optional(),
    TOKENMOVIL: z.string().nullable().optional(),
    CAPTCHA_PUBLIC_KEY: z.string().optional(),
    CAPTCHA_SECRET_KEY: z.string().optional(),
    BUQ_ENV: z.string().optional(),
    GAFAPAY_FRONT_URL: z.string().optional(),
    IMAGES: imagesSchema,
    THEME: legacyThemeSchema,
  })
  .passthrough();

export type GafaSdkConfigInput = z.input<typeof sdkConfigSchema>;
export type LegacyGfOptions = z.input<typeof legacyOptionsSchema>;

export function parseGafaSdkConfig(input: unknown): GafaSdkConfig {
  const parsed = sdkConfigSchema.parse(input);
  const resolved = withBuqEnvironment(parsed);
  return {
    ...parsed,
    environment: resolved.environment,
    apiBaseUrl: resolved.apiBaseUrl,
    gafaPayFrontUrl: resolved.gafaPayFrontUrl,
  };
}

export const parseSdkConfig = parseGafaSdkConfig;

export function legacyOptionsToConfig(input: unknown): GafaSdkConfig {
  const legacyOptions = legacyOptionsSchema.parse(input);

  return parseGafaSdkConfig({
    apiBaseUrl: legacyOptions.GAFA_FIT_URL,
    companyId: legacyOptions.COMPANY_ID,
    publicClientId: legacyOptions.API_CLIENT,
    clientSecret: legacyOptions.API_SECRET,
    brandId: legacyOptions.BRAND_ID,
    tokenMovil: legacyOptions.TOKENMOVIL,
    captchaPublicKey: legacyOptions.CAPTCHA_PUBLIC_KEY,
    captchaSecretKey: legacyOptions.CAPTCHA_SECRET_KEY,
    environment: legacyOptions.BUQ_ENV,
    gafaPayFrontUrl: legacyOptions.GAFAPAY_FRONT_URL,
    images: legacyOptions.IMAGES,
    theme: legacyOptions.THEME,
  });
}

export function readLegacyOptionsFromDom(documentRef: Document = document): GafaSdkConfig {
  const optionsElement =
    documentRef.querySelector("[data-gafa-options]") ?? documentRef.querySelector("[data-gf-options]");

  if (!optionsElement) {
    throw new Error("GFTheme options were not found. Expected a [data-gf-options] JSON script.");
  }

  const json = optionsElement.textContent?.trim();

  if (!json) {
    throw new Error("GFTheme options are empty.");
  }

  const raw = JSON.parse(json) as Record<string, unknown>;
  const queryEnv =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("buq-env") ??
        new URLSearchParams(window.location.search).get("gafa-env")
      : null;
  if (queryEnv) raw.BUQ_ENV = queryEnv;

  return legacyOptionsToConfig(raw);
}

export const parseLegacyOptions = legacyOptionsToConfig;
