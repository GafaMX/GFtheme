import { afterEach, describe, expect, it } from "vitest";
import {
  aliasV2Shortcodes,
  clearSdkRoot,
  isAutoScanEnabled,
  isSdkRootMounted,
  markExplicitRoot,
  markSdkRoot,
  sameSdkIdentity,
  SDK_EXPLICIT_ATTR,
  SDK_ROOT_ATTR,
  shouldSkipWidgetMount,
} from "./lifecycle";

describe("sdk lifecycle helpers", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-gf-autoscan");
    document.body.removeAttribute("data-gf-autoscan");
    document.body.replaceChildren();
    delete (window as Window & { GAFA_SDK_AUTOSCAN?: boolean }).GAFA_SDK_AUTOSCAN;
  });

  it("treats the same company, client and api as one identity", () => {
    expect(
      sameSdkIdentity(
        { companyId: 1, publicClientId: "pub", apiBaseUrl: "https://a.example/v1" },
        { companyId: 1, publicClientId: "pub", apiBaseUrl: "https://a.example/v1/" },
      ),
    ).toBe(true);
    expect(
      sameSdkIdentity(
        { companyId: 1, publicClientId: "pub", apiBaseUrl: "https://a.example/v1" },
        { companyId: 2, publicClientId: "pub", apiBaseUrl: "https://a.example/v1" },
      ),
    ).toBe(false);
  });

  it("disables auto-scan from window flag or data-gf-autoscan", () => {
    expect(isAutoScanEnabled(document, window)).toBe(true);
    (window as Window & { GAFA_SDK_AUTOSCAN?: boolean }).GAFA_SDK_AUTOSCAN = false;
    expect(isAutoScanEnabled(document, window)).toBe(false);
    delete (window as Window & { GAFA_SDK_AUTOSCAN?: boolean }).GAFA_SDK_AUTOSCAN;
    document.documentElement.setAttribute("data-gf-autoscan", "off");
    expect(isAutoScanEnabled(document, window)).toBe(false);
  });

  it("skips auto-scan inside an exclusive explicit root", () => {
    const spa = document.createElement("div");
    const widget = document.createElement("div");
    spa.appendChild(widget);
    document.body.appendChild(spa);
    markExplicitRoot(spa);
    expect(shouldSkipWidgetMount(widget, "auto")).toBe(true);
    expect(shouldSkipWidgetMount(widget, "explicit")).toBe(false);
    markSdkRoot(widget);
    expect(shouldSkipWidgetMount(widget, "explicit")).toBe(true);
    clearSdkRoot(spa);
    clearSdkRoot(widget);
    expect(spa.hasAttribute(SDK_EXPLICIT_ATTR)).toBe(false);
    expect(widget.hasAttribute(SDK_ROOT_ATTR)).toBe(false);
    expect(isSdkRootMounted(widget)).toBe(false);
  });

  it("does not skip a widget that was never marked", () => {
    const widget = document.createElement("div");
    document.body.appendChild(widget);
    expect(isSdkRootMounted(widget)).toBe(false);
    expect(shouldSkipWidgetMount(widget, "auto")).toBe(false);
  });

  it("aliases data-gafa-v2 on the root itself, not only descendants", () => {
    const node = document.createElement("div");
    node.setAttribute("data-gafa-v2", "login-register");
    document.body.appendChild(node);
    aliasV2Shortcodes(node);
    expect(node.getAttribute("data-gf-theme")).toBe("login-register");
  });
});
