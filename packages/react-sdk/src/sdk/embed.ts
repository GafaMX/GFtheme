import { createGafaSdk, type GafaSdk, type RuntimeOptions } from "./runtime";
import { readLegacyOptionsFromDom, type GafaSdkConfig } from "./config";
import { readEmbedOptionsFromDom } from "./config/embedOptions";
import { bootstrapLegacyWidgets } from "./bootstrap/legacyBootstrap";
import {
  aliasV2Shortcodes,
  createReadyLatch,
  isAutoScanEnabled,
  sameSdkIdentity,
  type ReadyLatch,
} from "./lifecycle";

export type EmbedHostWindow = {
  GafaThemeSDK?: GafaSdk;
  GafaSdk?: GafaSdk;
  GafaSdkReady?: Promise<GafaSdk>;
  GAFA_SDK_AUTOSCAN?: boolean;
};

declare global {
  interface Window {
    GafaThemeSDK?: GafaSdk;
    GafaSdk?: GafaSdk;
    GafaSdkReady?: Promise<GafaSdk>;
    GAFA_SDK_AUTOSCAN?: boolean;
  }
}

const readyLatches = new WeakMap<object, ReadyLatch<GafaSdk>>();

function ensureReadyGetter(win: EmbedHostWindow): void {
  const desc = Object.getOwnPropertyDescriptor(win, "GafaSdkReady");
  if (desc?.get) return;
  Object.defineProperty(win, "GafaSdkReady", {
    configurable: true,
    enumerable: true,
    get(): Promise<GafaSdk> {
      const latch = readyLatches.get(win as object);
      const wait = win.GafaThemeSDK
        ? Promise.resolve()
        : latch
          ? latch.promise.then(() => undefined)
          : Promise.reject(new Error("[gafa-sdk] No arrancó"));
      return wait.then(() => {
        const sdk = win.GafaThemeSDK;
        if (!sdk) throw new Error("[gafa-sdk] No arrancó");
        return sdk;
      });
    },
  });
}

function readyLatchFor(win: EmbedHostWindow): ReadyLatch<GafaSdk> {
  const key = win as object;
  ensureReadyGetter(win);
  const existing = readyLatches.get(key);
  if (existing && !existing.settled) return existing;
  if (existing?.settled && win.GafaThemeSDK) return existing;
  const latch = createReadyLatch<GafaSdk>();
  readyLatches.set(key, latch);
  return latch;
}

function resetReadyLatch(win: EmbedHostWindow): ReadyLatch<GafaSdk> {
  const latch = createReadyLatch<GafaSdk>();
  readyLatches.set(win as object, latch);
  ensureReadyGetter(win);
  return latch;
}

export function bootGafaSdk(
  options: GafaSdkConfig,
  documentRef: Document = document,
  win: EmbedHostWindow = window as EmbedHostWindow,
  runtimeOptions?: RuntimeOptions,
): GafaSdk {
  const previous = win.GafaThemeSDK;
  if (previous && typeof previous.mount === "function" && sameSdkIdentity(previous.config, options)) {
    const latch = readyLatchFor(win);
    aliasV2Shortcodes(documentRef);
    if (isAutoScanEnabled(documentRef, win)) {
      bootstrapLegacyWidgets(previous, documentRef, { mode: "auto" });
    }
    latch.resolve(previous);
    win.GafaThemeSDK = previous;
    win.GafaSdk = previous;
    return previous;
  }

  if (previous && typeof previous.unmountAll === "function") {
    previous.unmountAll();
  }

  const latch = readyLatchFor(win);
  let created: GafaSdk | undefined;
  try {
    const sdk = createGafaSdk(options, runtimeOptions);
    created = sdk;
    aliasV2Shortcodes(documentRef);
    const autoScan = isAutoScanEnabled(documentRef, win);
    const mounted = autoScan
      ? bootstrapLegacyWidgets(sdk, documentRef, { mode: "auto" })
      : { mounted: 0, widgets: [] as string[] };
    if (!autoScan) {
      sdk.enablePurchaseButtons(documentRef.body ?? undefined);
    }
    sdk.heartbeat(mounted.widgets);
    win.GafaThemeSDK = sdk;
    win.GafaSdk = sdk;
    latch.resolve(sdk);
    sdk.emit("buq:sdk:ready", { companyId: sdk.config.companyId, widgets: mounted.widgets });
    return sdk;
  } catch (error) {
    created?.unmountAll();
    if (win.GafaThemeSDK === created || win.GafaThemeSDK === previous) {
      delete win.GafaThemeSDK;
      delete win.GafaSdk;
    }
    latch.reject(error);
    resetReadyLatch(win);
    throw error;
  }
}

/**
 * Arranque drop-in para WordPress / HTML plano: lee `[data-gf-options]` (o
 * `[data-gafa-options]`), monta `[data-gf-theme]` / `[data-gafa-v2]` y deja
 * `window.GafaThemeSDK` (la instancia, no la clase estática del theme v1).
 *
 * Síncrono: solo DOM + query. El IIFE usa `bootGafaSdkFromDomWithRemote`.
 */
export function bootGafaSdkFromDom(
  documentRef: Document = document,
  win: EmbedHostWindow = window as EmbedHostWindow,
  runtimeOptions?: RuntimeOptions,
): GafaSdk {
  return bootGafaSdk(readLegacyOptionsFromDom(documentRef), documentRef, win, runtimeOptions);
}

/** DOM + Hub (fail-open) + query. */
export async function bootGafaSdkFromDomWithRemote(
  documentRef: Document = document,
  win: EmbedHostWindow = window as EmbedHostWindow,
  runtimeOptions?: RuntimeOptions,
): Promise<GafaSdk> {
  const options = await readEmbedOptionsFromDom(documentRef);
  return bootGafaSdk(options, documentRef, win, runtimeOptions);
}

export function startEmbedWhenReady(
  documentRef: Document = document,
  win: EmbedHostWindow = window as EmbedHostWindow,
  runtimeOptions?: RuntimeOptions,
): Promise<GafaSdk> {
  const latch = readyLatchFor(win);
  const run = () => {
    if (import.meta.env.MODE === "test") {
      try {
        return Promise.resolve(bootGafaSdkFromDom(documentRef, win, runtimeOptions));
      } catch (error) {
        latch.reject(error);
        resetReadyLatch(win);
        return Promise.reject(error);
      }
    }
    return bootGafaSdkFromDomWithRemote(documentRef, win, runtimeOptions).catch((error) => {
      console.warn("[gafa-sdk] No arrancó:", error instanceof Error ? error.message : error);
      if (!latch.settled) {
        latch.reject(error);
        resetReadyLatch(win);
      }
      throw error;
    });
  };
  if (documentRef.readyState === "loading") {
    return new Promise((resolve, reject) => {
      documentRef.addEventListener(
        "DOMContentLoaded",
        () => {
          void run().then(resolve, reject);
        },
        { once: true },
      );
    });
  }
  return run();
}

if (import.meta.env.MODE !== "test") {
  readyLatchFor(window as EmbedHostWindow);
  void startEmbedWhenReady();
}
