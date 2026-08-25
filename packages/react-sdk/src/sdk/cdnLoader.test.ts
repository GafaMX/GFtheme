import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import {
  GAFA_SDK_FALLBACK_BUNDLE,
  GAFA_SDK_PUBLIC_SCRIPT,
  GAFA_SDK_VERSION_URLS,
  parseEmbedVersion,
  resolveBundleUrl,
} from "./cdnLoader";

const LOADER_PATH = resolve(__dirname, "../../../../scripts/gafa-sdk-loader.js");

describe("cdnLoader", () => {
  it("la URL pública de los sitios no cambia", () => {
    expect(GAFA_SDK_PUBLIC_SCRIPT).toBe(
      "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js",
    );
  });

  it("lee el nombre stampado del bundle desde VERSION.txt", () => {
    const parsed = parseEmbedVersion(
      "commit=8256c6b2c7f3ae5d43a0c7ac32438359a18f012d\nshort=8256c6b\nbundle=gafa-sdk.bundle.20260825T001201Z.js\n",
    );
    expect(parsed.bundle).toBe("gafa-sdk.bundle.20260825T001201Z.js");
    expect(resolveBundleUrl("bundle=gafa-sdk.bundle.20260825T001201Z.js\n")).toBe(
      "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.bundle.20260825T001201Z.js",
    );
  });

  it("si no hay bundle stampado usa el commit (jsDelivr inmutable)", () => {
    expect(resolveBundleUrl("commit=a5f01af76509b24a483a9b7722e6279a754e3732\n")).toBe(
      "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@a5f01af76509b24a483a9b7722e6279a754e3732/docs/v2-sdk/gafa-sdk.bundle.js",
    );
  });

  it("sin VERSION cae al bundle @cdn-live", () => {
    expect(resolveBundleUrl("")).toBe(GAFA_SDK_FALLBACK_BUNDLE);
  });
});

describe("gafa-sdk-loader.js", () => {
  const host = window as Window & { __GAFA_SDK_LOADER__?: boolean };

  afterEach(() => {
    delete host.__GAFA_SDK_LOADER__;
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("está alineado con las URLs del helper y no pide otra rama", () => {
    const source = readFileSync(LOADER_PATH, "utf8");
    expect(source).toContain(GAFA_SDK_PUBLIC_SCRIPT);
    expect(source).toContain(GAFA_SDK_VERSION_URLS[0]);
    expect(source).toContain(GAFA_SDK_FALLBACK_BUNDLE);
    expect(source).not.toMatch(/cdn-live-\d/);
  });

  it("inyecta el bundle stampado que publica VERSION.txt en GitHub raw", async () => {
    const source = readFileSync(LOADER_PATH, "utf8");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "bundle=gafa-sdk.bundle.20260825T000000Z.js\ncommit=deadbeef\n",
    });
    vi.stubGlobal("fetch", fetchMock);

    // eslint-disable-next-line no-eval
    eval(source);

    expect(fetchMock).toHaveBeenCalledWith(GAFA_SDK_VERSION_URLS[0], { cache: "no-store" });
    await waitFor(() => {
      const injected = [...document.querySelectorAll("script")].map((node) => node.getAttribute("src"));
      expect(injected).toContain(
        "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.bundle.20260825T000000Z.js",
      );
    });
  });

  it("si raw falla carga el bundle estable @cdn-live", async () => {
    const source = readFileSync(LOADER_PATH, "utf8");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    // eslint-disable-next-line no-eval
    eval(source);

    await waitFor(() => {
      const injected = [...document.querySelectorAll("script")].map((node) => node.getAttribute("src"));
      expect(injected).toContain(GAFA_SDK_FALLBACK_BUNDLE);
    });
  });
});
