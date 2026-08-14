import { createGafaSdk, type GafaSdk, type RuntimeOptions } from "./runtime";
import { readLegacyOptionsFromDom } from "./config";
import { bootstrapLegacyWidgets } from "./bootstrap/legacyBootstrap";

export type EmbedHostWindow = {
  GafaThemeSDK?: GafaSdk;
};

declare global {
  interface Window {
    GafaThemeSDK?: GafaSdk;
  }
}

/**
 * Arranque drop-in para WordPress / HTML plano: lee `[data-gf-options]`,
 * monta todos los `[data-gf-theme]` y deja `window.GafaThemeSDK` (la instancia,
 * no la clase estática del theme v1).
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
  bootstrapLegacyWidgets(sdk, documentRef);
  win.GafaThemeSDK = sdk;
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
