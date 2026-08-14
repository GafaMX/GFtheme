import { afterEach, describe, expect, it } from "vitest";
import {
  BUQ_ENVIRONMENTS,
  parseBuqEnvironmentId,
  readBuqEnvironmentFromLocation,
  resolveBuqEnvironment,
  withBuqEnvironment,
} from "./buqEnvironments";
import { legacyOptionsToConfig, parseGafaSdkConfig } from "../config";

describe("buq environments", () => {
  afterEach(() => {
    window.history.pushState("", document.title, "/");
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
  });

  it("lee ?buq-env de la URL", () => {
    expect(readBuqEnvironmentFromLocation("?foo=1&buq-env=dev")).toBe("development");
  });
});
