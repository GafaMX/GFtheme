import { afterEach, describe, expect, it } from "vitest";
import { parseGafaSdkConfig, legacyOptionsToConfig } from "../config";
import { sanitizeHubRemoteConfig } from "./remoteConfig";
import { DEFAULT_SDK_BACKEND, parseSdkBackendId, resolveSdkBackend } from "./sdkBackend";

describe("sdk backend", () => {
  afterEach(() => {
    window.history.pushState("", document.title, "/");
    document.documentElement.removeAttribute("data-backend");
    document.body.innerHTML = "";
  });

  it("default es gafa", () => {
    expect(DEFAULT_SDK_BACKEND).toBe("gafa");
    expect(resolveSdkBackend()).toBe("gafa");
    expect(parseSdkBackendId("nope")).toBeUndefined();
  });

  it("runtime gana sobre query, atributo y config", () => {
    window.history.pushState("", document.title, "/?backend=buq-next");
    document.documentElement.setAttribute("data-backend", "buq-next");
    expect(
      resolveSdkBackend({
        runtimeBackend: "gafa",
        configBackend: "buq-next",
      }),
    ).toBe("gafa");
  });

  it("query ?backend= gana sobre data-backend y config", () => {
    document.documentElement.setAttribute("data-backend", "gafa");
    expect(
      resolveSdkBackend({
        configBackend: "gafa",
        search: "?backend=buq-next",
      }),
    ).toBe("buq-next");
  });

  it("BACKEND del JSON de la página es opt-in válido", () => {
    const config = legacyOptionsToConfig({
      COMPANY_ID: 9001,
      BACKEND: "buq-next",
    });
    expect(config.backend).toBe("buq-next");
    expect(parseGafaSdkConfig({ companyId: 1, backend: "buq-next" }).backend).toBe("buq-next");
  });

  it("un BACKEND inválido no cambia el default", () => {
    const config = legacyOptionsToConfig({ COMPANY_ID: 1, BACKEND: "mystery" });
    expect(config.backend).toBeUndefined();
  });

  it("el Hub no puede persistir ni servir BACKEND", () => {
    expect(
      sanitizeHubRemoteConfig({
        BACKEND: "buq-next",
        backend: "buq-next",
        THEME: { colorScheme: "dark" },
      }),
    ).toEqual({ THEME: { colorScheme: "dark" } });
  });
});
