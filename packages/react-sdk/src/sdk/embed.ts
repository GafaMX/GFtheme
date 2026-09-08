import { createGafaSdk, type GafaSdk, type RuntimeOptions } from "./runtime";
import { readLegacyOptionsFromDom, type GafaSdkConfig } from "./config";
import { readEmbedOptionsFromDom } from "./config/embedOptions";
import { bootstrapLegacyWidgets } from "./bootstrap/legacyBootstrap";

export type EmbedHostWindow = {
  GafaThemeSDK?: GafaSdk;
  GafaSdk?: GafaSdk;
};

declare global {
  interface Window {
    GafaThemeSDK?: GafaSdk;
    GafaSdk?: GafaSdk;
  }
}

/**
 * Páginas que montan v2 al lado del theme v1 usan `data-gafa-v2` en vez de
 * `data-gf-theme` para no pelear con el script viejo. El bootstrap de shortcodes
 * solo mira `data-gf-theme`, así que se copia el alias antes de montar.
 */
function aliasV2Shortcodes(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-gafa-v2]").forEach((element) => {
    if (!element.getAttribute("data-gf-theme")) {
      element.setAttribute("data-gf-theme", element.getAttribute("data-gafa-v2") || "");
    }
  });
}

export function bootGafaSdk(
  options: GafaSdkConfig,
  documentRef: Document = document,
  win: EmbedHostWindow = window as EmbedHostWindow,
  runtimeOptions?: RuntimeOptions,
): GafaSdk {
  const sdk = createGafaSdk(options, runtimeOptions);
  aliasV2Shortcodes(documentRef);
  const mounted = bootstrapLegacyWidgets(sdk, documentRef);
  sdk.heartbeat(mounted.widgets);
  win.GafaThemeSDK = sdk;
  win.GafaSdk = sdk;
  return sdk;
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
): void {
  const run = () => {
    if (import.meta.env.MODE === "test") {
      bootGafaSdkFromDom(documentRef, win, runtimeOptions);
      return;
    }
    void bootGafaSdkFromDomWithRemote(documentRef, win, runtimeOptions);
  };
  if (documentRef.readyState === "loading") {
    documentRef.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}

if (import.meta.env.MODE !== "test") {
  startEmbedWhenReady();
}
