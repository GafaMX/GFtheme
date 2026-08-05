import { z } from "zod";
import type { GafaBrandTheme } from "./theme/theme";

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
    apiBaseUrl: z.string().min(1),
    companyId: z.union([z.string(), z.number()]).transform(Number),
    publicClientId: z.union([z.string(), z.number()]).optional(),
    // OAuth2 password-grant client secret. Se envia desde el navegador porque asi lo exige
    // hoy la API de gafa.fit (mismo patron ya usado por el theme legacy) -- no es un cambio
    // de postura de seguridad de este SDK, es el contrato existente.
    clientSecret: z.string().optional(),
    brandId: z.union([z.string(), z.number()]).transform(Number).optional(),
    tokenMovil: z.string().nullable().optional(),
    captchaProvider: z.enum(["recaptcha-v3", "turnstile"]).default("recaptcha-v3"),
    captchaPublicKey: z.string().optional(),
    // Igual que clientSecret: gafa.fit valida el reCAPTCHA en el server usando esta secret key
    // que el cliente le manda en cada registro (ver App\Rules\Captcha). Viene asi del backend.
    captchaSecretKey: z.string().optional(),
    language: z.enum(["es", "en"]).default("es"),
    theme: legacyThemeSchema,
  })
  .passthrough();

export type GafaSdkConfig = z.infer<typeof sdkConfigSchema> & {
  theme?: GafaBrandTheme;
};

const legacyOptionsSchema = z
  .object({
    GAFA_FIT_URL: z.string().min(1),
    COMPANY_ID: z.union([z.string(), z.number()]),
    API_CLIENT: z.union([z.string(), z.number()]).optional(),
    API_SECRET: z.string().optional(),
    BRAND_ID: z.union([z.string(), z.number()]).optional(),
    TOKENMOVIL: z.string().nullable().optional(),
    CAPTCHA_PUBLIC_KEY: z.string().optional(),
    CAPTCHA_SECRET_KEY: z.string().optional(),
    THEME: legacyThemeSchema,
  })
  .passthrough();

export type GafaSdkConfigInput = z.input<typeof sdkConfigSchema>;
export type LegacyGfOptions = z.input<typeof legacyOptionsSchema>;

export function parseGafaSdkConfig(input: unknown): GafaSdkConfig {
  return sdkConfigSchema.parse(input);
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
    theme: legacyOptions.THEME,
  });
}

export function readLegacyOptionsFromDom(documentRef: Document = document): GafaSdkConfig {
  const optionsElement = documentRef.querySelector("[data-gf-options]");

  if (!optionsElement) {
    throw new Error("GFTheme options were not found. Expected a [data-gf-options] JSON script.");
  }

  const json = optionsElement.textContent?.trim();

  if (!json) {
    throw new Error("GFTheme options are empty.");
  }

  return legacyOptionsToConfig(JSON.parse(json));
}

export const parseLegacyOptions = legacyOptionsToConfig;
