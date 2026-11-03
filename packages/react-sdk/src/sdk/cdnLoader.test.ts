import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import {
  GAFA_SDK_FALLBACK_BUNDLE,
  GAFA_SDK_GITHUB_TIP,
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

  it("un VERSION viejo sin bundle= no pinnea un commit (raw puede ir atrasado)", () => {
    expect(resolveBundleUrl("commit=a5f01af76509b24a483a9b7722e6279a754e3732\n")).toBe(
      GAFA_SDK_FALLBACK_BUNDLE,
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
    sessionStorage.removeItem("gafa-sdk-cdn-sha");
    sessionStorage.removeItem("gafa-sdk-cdn-sha:cdn-live");
    sessionStorage.removeItem("gafa-sdk-cdn-sha:staging");
    sessionStorage.removeItem("gafa-sdk-password-reset-link");
    Object.defineProperty(document, "currentScript", {
      configurable: true,
      get: () => null,
    });
  });

  it("está alineado con las URLs del helper y no pide otra rama", () => {
    const source = readFileSync(LOADER_PATH, "utf8");
    expect(source).toContain(GAFA_SDK_PUBLIC_SCRIPT);
    expect(source).toContain('DEFAULT_REF = "cdn-live"');
    expect(source).toContain("/GafaMX/GFtheme/\" + REF + \"/docs/v2-sdk/VERSION.txt");
    expect(source).toContain("commits/\" + REF");
    expect(source).toContain("@\" + REF + \"/docs/v2-sdk/gafa-sdk.bundle.js");
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
    expect(fetchMock).not.toHaveBeenCalledWith(GAFA_SDK_GITHUB_TIP, expect.anything());
    await waitFor(() => {
      const injected = [...document.querySelectorAll("script")].map((node) => node.getAttribute("src"));
      expect(injected).toEqual([
        "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.bundle.20260825T000000Z.js",
      ]);
    });
  });

  it("si raw no trae bundle= pide el tip de GitHub y pinnea el SHA", async () => {
    const source = readFileSync(LOADER_PATH, "utf8");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("VERSION.txt")) {
        return { ok: true, text: async () => "commit=a5f01af\nbytes=717173\n" };
      }
      return { ok: true, text: async () => "a03b67912d4d8fea7f126ec5bfdecc4302e9d842\n" };
    });
    vi.stubGlobal("fetch", fetchMock);

    // eslint-disable-next-line no-eval
    eval(source);

    await waitFor(() => {
      const injected = [...document.querySelectorAll("script")].map((node) => node.getAttribute("src"));
      expect(injected).toContain(
        "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@a03b67912d4d8fea7f126ec5bfdecc4302e9d842/docs/v2-sdk/gafa-sdk.bundle.js",
      );
    });
  });

  it("snapshot de token+email ANTES de bajar el bundle (carrera con Weglot)", () => {
    const source = readFileSync(LOADER_PATH, "utf8");
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    window.history.replaceState(null, "", "/reservar#horario?token=tok123&email=ana+1@buq.mx");

    // eslint-disable-next-line no-eval
    eval(source);

    expect(sessionStorage.getItem("gafa-sdk-password-reset-link")).toContain("token=tok123");
    expect(sessionStorage.getItem("gafa-sdk-password-reset-link")).toContain("ana+1@buq.mx");
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

  it("si el src es @staging pide VERSION y el bundle de staging", async () => {
    const source = readFileSync(LOADER_PATH, "utf8");
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@staging/docs/v2-sdk/gafa-sdk.js";
    document.head.appendChild(script);
    Object.defineProperty(document, "currentScript", {
      configurable: true,
      get: () => script,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "bundle=gafa-sdk.bundle.20261103T000000Z.js\ncommit=deadbeef\n",
    });
    vi.stubGlobal("fetch", fetchMock);

    // eslint-disable-next-line no-eval
    eval(source);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/GafaMX/GFtheme/staging/docs/v2-sdk/VERSION.txt",
      { cache: "no-store" },
    );
    await waitFor(() => {
      const injected = [...document.querySelectorAll("script")].map((node) => node.getAttribute("src"));
      expect(injected).toContain(
        "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@staging/docs/v2-sdk/gafa-sdk.bundle.20261103T000000Z.js",
      );
    });
  });
});
