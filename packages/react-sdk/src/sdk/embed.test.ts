import { afterEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { bootGafaSdkFromDom, startEmbedWhenReady, type EmbedHostWindow } from "./embed";

const OPTIONS_JSON = JSON.stringify({
  GAFA_FIT_URL: "https://example.gafa.fit",
  COMPANY_ID: 80,
  API_CLIENT: "demo-client",
});

function mountHost(extraHtml = "") {
  document.body.innerHTML = `
    <script data-gf-options type="application/json">${OPTIONS_JSON}</script>
    ${extraHtml}
  `;
}

describe("embed drop-in", () => {
  afterEach(() => {
    const host = window as EmbedHostWindow;
    host.GafaThemeSDK?.unmountAll();
    delete host.GafaThemeSDK;
    document.body.innerHTML = "";
  });

  it("exige data-gf-options, igual que el theme v1", () => {
    document.body.innerHTML = `<div data-gf-theme="login-register"></div>`;
    expect(() => bootGafaSdkFromDom(document, window, { useMockClient: true })).toThrow(
      /data-gf-options/,
    );
  });

  it("expone window.GafaThemeSDK y monta login-register", async () => {
    mountHost(`<div data-gf-theme="login-register"></div>`);
    const sdk = bootGafaSdkFromDom(document, window, { useMockClient: true });
    expect((window as EmbedHostWindow).GafaThemeSDK).toBe(sdk);
    expect(sdk.config.companyId).toBe(80);
    expect(sdk.config.apiBaseUrl).toBe("https://example.gafa.fit");
    await waitFor(() => {
      expect(
        document.querySelector("[data-gf-theme='login-register']")?.childElementCount,
      ).toBeGreaterThan(0);
    });
  });

  it("startEmbedWhenReady arranca enseguida si el DOM ya está listo", () => {
    mountHost();
    const host: EmbedHostWindow = {};
    startEmbedWhenReady(document, host, { useMockClient: true });
    expect(host.GafaThemeSDK?.config.companyId).toBe(80);
    host.GafaThemeSDK?.unmountAll();
  });
});
