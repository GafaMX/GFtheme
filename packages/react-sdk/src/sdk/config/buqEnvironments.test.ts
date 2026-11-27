import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BUQ_ENVIRONMENTS,
  parseBuqEnvironmentId,
  readBuqEnvironmentFromLocation,
  resolveBuqEnvironment,
  withBuqEnvironment,
} from "./buqEnvironments";
import {
  DEFAULT_CAPTCHA_PUBLIC_KEY,
  DEFAULT_CAPTCHA_SECRET_KEY,
  legacyOptionsToConfig,
  parseGafaSdkConfig,
} from "../config";

describe("buq environments", () => {
  afterEach(() => {
    window.history.pushState("", document.title, "/");
  });

  it.each([undefined, "production"])("producción conserva GAFA_FIT_URL con path (BUQ_ENV=%s)", (environment) => {
    window.history.replaceState(null, "", "/?buq-env=production");
    expect(legacyOptionsToConfig({ COMPANY_ID: 1, BUQ_ENV: environment,
      GAFA_FIT_URL: "https://buq.partners/custom/" }).apiBaseUrl).toBe("https://buq.partners/custom/");
  });

  for (const environment of ["staging", "development"]) {
    it.each(["https://buq.partners/", "https://BUQ.PARTNERS./custom/", "https://api.gafa.fit/", "/relative", "javascript:alert(1)"])(
      `${environment} rechaza Laravel inseguro: %s`, (apiBaseUrl) => {
        expect(() => legacyOptionsToConfig({ COMPANY_ID: 1, BUQ_ENV: environment, GAFA_FIT_URL: apiBaseUrl })).toThrow(/GAFA_FIT_URL/);
        expect(() => parseGafaSdkConfig({ companyId: 1, environment, apiBaseUrl })).toThrow(/GAFA_FIT_URL/);
      },
    );
    it("rechaza Hub de producción antes de usarlo en " + environment, () => {
      expect(() => parseGafaSdkConfig({ companyId: 1, environment, hubUrl: "https://hub.buq.partners" })).toThrow(/HUB_URL/);
    });
  }

  it("fija byte por byte la resolución histórica de producción", () => {
    expect(resolveBuqEnvironment({})).toEqual({
      id: "production", label: "Production",
      apiBaseUrl: "https://buq.partners/",
      gafaFitSdkUrl: "https://buq.partners/sdk/dist/main.js",
      gafaPayFrontUrl: "https://frontpay.buq.partners/main.js",
      gafaPayApiUrl: "https://apipay.buq.partners",
      stripePaymentScriptUrl: "https://buq.partners/js/payments/stripe-payment.iife.js",
      hubUrl: "https://hub.buq.partners",
    });
  });

  it.each([
    { BUQ_ENV: "staging" },
    { GAFA_FIT_URL: "https://buq.com.mx/" },
  ])("resuelve staging completo: %j", (options) => {
    const config = legacyOptionsToConfig({ COMPANY_ID: 1, ...options });
    expect(config.gafaPayFrontUrl).toBe("https://gafapay-front-dev.azurewebsites.net/prodbuild/main.js");
    expect(config.gafaPayApiUrl).toBe("https://gafapay-api-gafapay-api-test.azurewebsites.net");
    expect(config.stripePaymentScriptUrl).toBe("https://buq.com.mx/js/payments/stripe-payment.iife.js");
  });

  it("la página de staging usa el mismo prodbuild y development conserva /main.js", () => {
    const html = readFileSync("../../docs/v2-sdk-staging/index.html", "utf8");
    expect(html).toContain(`GAFAPAY_FRONT_URL: "${BUQ_ENVIRONMENTS.staging.gafaPayFrontUrl}"`);
    expect(BUQ_ENVIRONMENTS.development.gafaPayFrontUrl).toBe("https://frontpay.buq.partners/main.js");
    expect(html).toContain("@staging-live/docs/v2-sdk-staging/gafa-sdk.js");
    const loader = readFileSync("../../scripts/gafa-sdk-loader-staging.js", "utf8");
    for (const source of [html, loader]) {
      expect(source).not.toMatch(/(?:@|\/)cdn-live\//);
      expect(source).not.toContain("/docs/v2-sdk/");
    }
  });

  it("query staging cambia las tres URLs y Laravel aunque el JSON seleccione prod", () => {
    window.history.pushState(null, "", "/?buq-env=staging");
    const config = legacyOptionsToConfig({ COMPANY_ID: 1, BUQ_ENV: "production", GAFA_FIT_URL: "https://buq.partners/" });
    expect(config.environment).toBe("staging");
    expect(config.apiBaseUrl).toBe("https://buq.com.mx/");
    expect(config.gafaPayFrontUrl).toBe(BUQ_ENVIRONMENTS.staging.gafaPayFrontUrl);
    expect(config.gafaPayApiUrl).toBe(BUQ_ENVIRONMENTS.staging.gafaPayApiUrl);
    expect(config.stripePaymentScriptUrl).toBe(BUQ_ENVIRONMENTS.staging.stripePaymentScriptUrl);
  });

  it.each([
    { GAFAPAY_FRONT_URL: "https://example.test/front.js", GAFAPAY_API_URL: "https://api.example.test", STRIPE_PAYMENT_SCRIPT_URL: "https://example.test/stripe.js" },
    { gafaPayFrontUrl: "https://example.test/front.js", gafaPayApiUrl: "https://api.example.test", stripePaymentScriptUrl: "https://example.test/stripe.js" },
  ])("acepta overrides de página: %j", (options) => {
    const config = legacyOptionsToConfig({ COMPANY_ID: 1, BUQ_ENV: "staging", ...options });
    expect(config.gafaPayFrontUrl).toBe("https://example.test/front.js");
    expect(config.gafaPayApiUrl).toBe("https://api.example.test");
    expect(config.stripePaymentScriptUrl).toBe("https://example.test/stripe.js");
  });

  it("acepta los overrides de config camelCase y prioriza uppercase en el embed", () => {
    const overrides = { gafaPayFrontUrl: "https://example.test/front.js", gafaPayApiUrl: "https://api.example.test", stripePaymentScriptUrl: "https://example.test/stripe.js" };
    expect(parseGafaSdkConfig({ companyId: 1, environment: "staging", ...overrides })).toMatchObject(overrides);
    expect(legacyOptionsToConfig({ COMPANY_ID: 1, ...overrides, GAFAPAY_API_URL: "https://upper.test" }).gafaPayApiUrl).toBe("https://upper.test");
  });

  it("reconoce aliases de staging/dev/prod", () => {
    expect(parseBuqEnvironmentId("staging")).toBe("staging");
    expect(parseBuqEnvironmentId("com.mx")).toBe("staging");
    expect(parseBuqEnvironmentId("technology")).toBe("development");
    expect(parseBuqEnvironmentId("partners")).toBe("production");
  });

  it("deduce el entorno de GAFA_FIT_URL", () => {
    expect(resolveBuqEnvironment({ apiBaseUrl: "https://buq.com.mx/" }).id).toBe("staging");
    expect(resolveBuqEnvironment({ apiBaseUrl: "https://buq.technology/" }).id).toBe("development");
    expect(resolveBuqEnvironment({ apiBaseUrl: "https://buq.partners/" }).id).toBe("production");
  });

  it("?buq-env=staging gana sobre el JSON", () => {
    expect(
      resolveBuqEnvironment({
        environment: "production",
        apiBaseUrl: "https://buq.partners/",
        search: "?buq-env=staging",
      }).id,
    ).toBe("staging");
  });

  it("rellena API y GafaPayFront si solo pones BUQ_ENV", () => {
    const resolved = withBuqEnvironment({ environment: "staging" });
    expect(resolved.apiBaseUrl).toBe(BUQ_ENVIRONMENTS.staging.apiBaseUrl);
    expect(resolved.gafaPayFrontUrl).toBe(BUQ_ENVIRONMENTS.staging.gafaPayFrontUrl);
  });

  it("GAFAPAY_FRONT_URL pisa el default del entorno", () => {
    const config = legacyOptionsToConfig({
      GAFA_FIT_URL: "https://buq.com.mx/",
      COMPANY_ID: 1,
      GAFAPAY_FRONT_URL: "https://example.test/gafapay.js",
    });
    expect(config.environment).toBe("staging");
    expect(config.apiBaseUrl).toBe("https://buq.com.mx/");
    expect(config.gafaPayFrontUrl).toBe("https://example.test/gafapay.js");
  });

  it("BUQ_ENV solo (sin GAFA_FIT_URL) rellena staging", () => {
    const config = legacyOptionsToConfig({
      BUQ_ENV: "staging",
      COMPANY_ID: 1,
    });
    expect(config.environment).toBe("staging");
    expect(config.apiBaseUrl).toBe("https://buq.com.mx/");
  });

  it("parseSdkConfig default sigue en production", () => {
    const config = parseGafaSdkConfig({
      apiBaseUrl: "https://buq.partners/",
      companyId: 1,
    });
    expect(config.environment).toBe("production");
    expect(config.gafaPayFrontUrl).toBe(BUQ_ENVIRONMENTS.production.gafaPayFrontUrl);
    expect(config.hubUrl).toBe("https://hub.buq.partners");
    expect(config.analyticsEnabled).toBe(true);
  });

  it("usa captcha default cuando la integracion manda llaves vacias", () => {
    const config = legacyOptionsToConfig({
      COMPANY_ID: 1,
      CAPTCHA_PUBLIC_KEY: "",
      CAPTCHA_SECRET_KEY: "   ",
    });

    expect(config.captchaPublicKey).toBe(DEFAULT_CAPTCHA_PUBLIC_KEY);
    expect(config.captchaSecretKey).toBe(DEFAULT_CAPTCHA_SECRET_KEY);
  });

  it("usa el par default si el Hub manda solo la llave publica", () => {
    const config = legacyOptionsToConfig({
      COMPANY_ID: 1,
      CAPTCHA_PUBLIC_KEY: "hub-only-public-key",
    });

    expect(config.captchaPublicKey).toBe(DEFAULT_CAPTCHA_PUBLIC_KEY);
    expect(config.captchaSecretKey).toBe(DEFAULT_CAPTCHA_SECRET_KEY);
  });

  it("usa el par default si camelCase trae publica sin secret", () => {
    const config = legacyOptionsToConfig({
      COMPANY_ID: 1,
      captchaPublicKey: "from-js-config",
    });

    expect(config.captchaPublicKey).toBe(DEFAULT_CAPTCHA_PUBLIC_KEY);
    expect(config.captchaSecretKey).toBe(DEFAULT_CAPTCHA_SECRET_KEY);
  });

  it("recorta llaves de captcha configuradas explicitamente", () => {
    const config = parseGafaSdkConfig({
      companyId: 1,
      captchaPublicKey: "  public-test-key  ",
      captchaSecretKey: "  secret-test-key  ",
    });

    expect(config.captchaPublicKey).toBe("public-test-key");
    expect(config.captchaSecretKey).toBe("secret-test-key");
  });

  it("HUB_URL pisa el default y ANALYTICS=false apaga el tracker", () => {
    const config = legacyOptionsToConfig({
      COMPANY_ID: 80,
      HUB_URL: "http://127.0.0.1:8787",
      ANALYTICS: "false",
    });
    expect(config.hubUrl).toBe("http://127.0.0.1:8787");
    expect(config.analyticsEnabled).toBe(false);
  });

  it("lee ?buq-env de la URL", () => {
    expect(readBuqEnvironmentFromLocation("?foo=1&buq-env=dev")).toBe("development");
  });

  it("SHOW_MEMBERSHIP_OPTIONS del embed llega al config", () => {
    const on = legacyOptionsToConfig({
      COMPANY_ID: 1,
      SHOW_MEMBERSHIP_OPTIONS: "true",
    });
    expect(on.showMembershipOptions).toBe(true);
    const off = legacyOptionsToConfig({ COMPANY_ID: 1 });
    expect(off.showMembershipOptions).toBeUndefined();
  });

  it("SHOW_WEEK_MEETING_NOTES del embed llega al config", () => {
    const on = legacyOptionsToConfig({
      COMPANY_ID: 80,
      SHOW_WEEK_MEETING_NOTES: "true",
    });
    expect(on.showWeekMeetingNotes).toBe(true);
    const off = legacyOptionsToConfig({ COMPANY_ID: 146 });
    expect(off.showWeekMeetingNotes).toBeUndefined();
  });

  it("CONCIERGE true llega al config del SDK (para el merge del Hub)", () => {
    const config = legacyOptionsToConfig({ COMPANY_ID: 190, CONCIERGE: true });
    expect(config.concierge).toBe(true);
  });

  it("CROSS_SELL del embed llega al config del SDK", () => {
    const config = legacyOptionsToConfig({
      COMPANY_ID: 80,
      CROSS_SELL: { enabled: true, itemType: "combo", itemId: 971, payTitle: "¿Donación?" },
    });
    expect(config.crossSell).toEqual({
      enabled: true,
      itemType: "combo",
      itemId: 971,
      payTitle: "¿Donación?",
    });
  });

  it("CLASS_RATINGS del embed llega al config y ausente queda off", () => {
    const on = legacyOptionsToConfig({
      COMPANY_ID: 80,
      CLASS_RATINGS: { enabled: true, rateClass: true, rateCoach: false },
    });
    expect(on.classRatings).toEqual({ enabled: true, rateClass: true, rateCoach: false });
    expect(legacyOptionsToConfig({ COMPANY_ID: 80 }).classRatings).toBeUndefined();
  });

  it("MEMBERSHIP_ENROLLMENT del embed llega al config", () => {
    const config = legacyOptionsToConfig({
      COMPANY_ID: 204,
      MEMBERSHIP_ENROLLMENT: {
        comboId: 3491,
        label: "Inscripción",
        membershipIds: [1272, 1271, 1204],
        firstTimeScope: "any_membership",
        mode: "first_purchase",
      },
    });
    expect(config.membershipEnrollment).toEqual({
      comboId: 3491,
      label: "Inscripción",
      membershipIds: [1272, 1271, 1204],
      firstTimeScope: "any_membership",
      mode: "first_purchase",
    });
  });
});
