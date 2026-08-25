/**
 * Puntero público del embed. Esta URL no se cambia en los sitios:
 * el archivo en git es un loader chico; el IIFE vive en gafa-sdk.bundle*.js.
 */
export const GAFA_SDK_PUBLIC_SCRIPT =
  "https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js";

export const GAFA_SDK_REPO = "GafaMX/GFtheme";
export const GAFA_SDK_BRANCH = "cdn-live";
export const GAFA_SDK_DIR = "docs/v2-sdk";

export const GAFA_SDK_VERSION_URLS = [
  `https://raw.githubusercontent.com/${GAFA_SDK_REPO}/${GAFA_SDK_BRANCH}/${GAFA_SDK_DIR}/VERSION.txt`,
] as const;

export const GAFA_SDK_FALLBACK_BUNDLE = `https://cdn.jsdelivr.net/gh/${GAFA_SDK_REPO}@${GAFA_SDK_BRANCH}/${GAFA_SDK_DIR}/gafa-sdk.bundle.js`;

export type EmbedVersion = {
  commit: string | null;
  bundle: string | null;
};

export function parseEmbedVersion(text: string): EmbedVersion {
  const commit = /(?:^|\n)commit=([0-9a-f]{7,40})(?:\r?\n|$)/.exec(text)?.[1] ?? null;
  const bundle = /(?:^|\n)bundle=([A-Za-z0-9._-]+\.js)(?:\r?\n|$)/.exec(text)?.[1] ?? null;
  return { commit, bundle };
}

export function jsdelivrFileUrl(ref: string, fileName: string): string {
  return `https://cdn.jsdelivr.net/gh/${GAFA_SDK_REPO}@${ref}/${GAFA_SDK_DIR}/${fileName}`;
}

/**
 * Resuelve el IIFE a pedir. Preferimos un nombre stampado en @cdn-live:
 * path nuevo = jsDelivr no tiene cache y lee GitHub al momento.
 */
export function resolveBundleUrl(versionText: string): string {
  const { bundle, commit } = parseEmbedVersion(versionText);
  if (bundle) {
    return jsdelivrFileUrl(GAFA_SDK_BRANCH, bundle);
  }
  if (commit) {
    return jsdelivrFileUrl(commit, "gafa-sdk.bundle.js");
  }
  return GAFA_SDK_FALLBACK_BUNDLE;
}
