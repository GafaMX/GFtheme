import { createGafaSdk, type GafaSdk, type RuntimeOptions } from "./runtime";
import { readLegacyOptionsFromDom } from "./config";
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

/**
 * Arranque drop-in para WordPress / HTML plano: lee `[data-gf-options]` (o
 * `[data-gafa-options]`), monta `[data-gf-theme]` / `[data-gafa-v2]` y deja
 * `window.GafaThemeSDK` (la instancia, no la clase estática del theme v1).
 *
 * El bundle IIFE (`gafa-sdk.js`) llama esto solo. En tests se invoca a mano
 * con `useMockClient: true` para no pegarle a gafa.fit.
 */
export function bootGafaSdkFromDom(
  documentRef: Document = document,
  win: EmbedHostWindow = window as EmbedHostWindow,
  runtimeOptions?: RuntimeOptions,
): GafaSdk {
  const options = readLegacyOptionsFromDom(documentRef);
  const sdk = createGafaSdk(options, runtimeOptions);
  aliasV2Shortcodes(documentRef);
  const mounted = bootstrapLegacyWidgets(sdk, documentRef);
  sdk.heartbeat(mounted.widgets);
  win.GafaThemeSDK = sdk;
  win.GafaSdk = sdk;
  return sdk;
}

export function startEmbedWhenReady(
  documentRef: Document = document,
  win: EmbedHostWindow = window as EmbedHostWindow,
  runtimeOptions?: RuntimeOptions,
): void {
  const run = () => bootGafaSdkFromDom(documentRef, win, runtimeOptions);
  if (documentRef.readyState === "loading") {
    documentRef.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
}

if (import.meta.env.MODE !== "test") {
  startEmbedWhenReady();
}
