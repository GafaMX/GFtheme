import type { ColorScheme } from "./palette";

const ATTRS = ["data-theme", "data-color-scheme", "data-bs-theme", "data-mode", "data-scheme"] as const;

/** `html.fitspin-dark` (Buq-Webs) y otras marcas de oscuro/claro en class. */
const DARK_CLASS = /(^|[\s_-])dark([\s_-]|$)/i;
const LIGHT_CLASS = /(^|[\s_-])light([\s_-]|$)/i;

/** Overlay CSS de Fitspin / Buq-Webs: `--sdk-*` en `:root` y `html.fitspin-dark`. */
export const HOST_SDK_VARS = {
  text: "--sdk-text-color",
  background: "--sdk-modal-bg",
  surface: "--sdk-background-color",
  surfaceRaised: "--sdk-input-bg",
  border: "--sdk-border-color",
  overlay: "--sdk-backdrop-bg",
} as const;

const HOST_THEME_STORAGE_KEYS = ["fitspin-theme"] as const;

export function schemeFromToken(value: string | null | undefined): ColorScheme | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("dark")) return "dark";
  if (normalized.includes("light")) return "light";
  return null;
}

function schemeFromClass(className: string): ColorScheme | null {
  if (DARK_CLASS.test(className)) return "dark";
  if (LIGHT_CLASS.test(className)) return "light";
  return null;
}

function schemeFromElement(el: Element | null): ColorScheme | null {
  if (!el) return null;
  for (const attr of ATTRS) {
    const fromAttr = schemeFromToken(el.getAttribute(attr));
    if (fromAttr) return fromAttr;
  }
  const className = typeof el.className === "string" ? el.className : el.getAttribute("class");
  return schemeFromClass(className ?? "");
}

function parseCssChannel(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith("%")) return (Number.parseFloat(trimmed) / 100) * 255;
  return Number.parseFloat(trimmed);
}

/** Luminancia relativa 0–1. null si el color no se entiende. */
export function luminanceFromCssColor(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const body = hex[1];
    const full =
      body.length === 3
        ? body
            .split("")
            .map((c) => c + c)
            .join("")
        : body;
    const r = Number.parseInt(full.slice(0, 2), 16) / 255;
    const g = Number.parseInt(full.slice(2, 4), 16) / 255;
    const b = Number.parseInt(full.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const rgb = /^rgba?\(\s*([0-9.%]+)\s*[, ]\s*([0-9.%]+)\s*[, ]\s*([0-9.%]+)/i.exec(value);
  if (rgb) {
    const r = parseCssChannel(rgb[1]) / 255;
    const g = parseCssChannel(rgb[2]) / 255;
    const b = parseCssChannel(rgb[3]) / 255;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  return null;
}

export function schemeFromCssColor(raw: string | null | undefined): ColorScheme | null {
  const luminance = luminanceFromCssColor(raw);
  if (luminance == null) return null;
  return luminance < 0.45 ? "dark" : "light";
}

function cssVar(root: Document, name: string): string {
  const inline = root.documentElement.style.getPropertyValue(name);
  if (inline.trim()) return inline;
  if (typeof getComputedStyle === "undefined") return "";
  const fromHtml = getComputedStyle(root.documentElement).getPropertyValue(name);
  if (fromHtml.trim()) return fromHtml;
  if (!root.body) return "";
  return getComputedStyle(root.body).getPropertyValue(name);
}

/**
 * Fitspin declara `--sdk-background-color` siempre (blanco por default).
 * Solo devolvemos `dark` para no tapar un THEME.dark de otro socio con el
 * blanco de `:root`.
 */
function readHostOverlayDark(root: Document): ColorScheme | null {
  const candidates = [cssVar(root, HOST_SDK_VARS.surface), cssVar(root, HOST_SDK_VARS.background)];
  for (const value of candidates) {
    const scheme = schemeFromCssColor(value);
    if (scheme === "dark") return "dark";
  }
  return null;
}

function readStoredSiteTheme(): ColorScheme | null {
  if (typeof localStorage === "undefined") return null;
  try {
    for (const key of HOST_THEME_STORAGE_KEYS) {
      const fromKey = schemeFromToken(localStorage.getItem(key));
      if (fromKey) return fromKey;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Lee el theme que ya puso el sitio (Fitspin: `html.fitspin-dark` +
 * localStorage `fitspin-theme` + overlay `--sdk-*`).
 * null = la página no declara nada.
 */
export function readHostColorScheme(root: Document = document): ColorScheme | null {
  const fromDom = schemeFromElement(root.documentElement) ?? schemeFromElement(root.body);
  if (fromDom) return fromDom;
  return readStoredSiteTheme() ?? readHostOverlayDark(root);
}

export function resolveActiveColorScheme(input: {
  hostScheme: ColorScheme | null;
  preference: ColorScheme | "system" | "host";
  osScheme: ColorScheme;
}): ColorScheme {
  if (input.hostScheme) return input.hostScheme;
  if (input.preference === "system" || input.preference === "host") return input.osScheme;
  return input.preference;
}

/**
 * Fuente de verdad del SDK.
 *
 * Lock (`allowUserColorScheme: false` + light/dark): solo THEME. Ni host,
 * ni localStorage, ni prefers-color-scheme. ATLIC / The Base.
 *
 * Sin lock: el host gana (Fitspin: `html.fitspin-dark` + `--sdk-*`).
 */
export function resolveSdkColorScheme(input: {
  colorScheme: ColorScheme | "system" | "host";
  allowUserColorScheme: boolean;
  storedPreference: ColorScheme | "system" | "host" | null;
  hostScheme: ColorScheme | null;
  osScheme: ColorScheme;
}): ColorScheme {
  if (!input.allowUserColorScheme && (input.colorScheme === "light" || input.colorScheme === "dark")) {
    return input.colorScheme;
  }
  return resolveActiveColorScheme({
    hostScheme: input.hostScheme,
    preference: input.storedPreference ?? input.colorScheme,
    osScheme: input.osScheme,
  });
}

/** El overlay de Fitspin pinta `--sdk-*`; el SDK V2 lee `--gafa-color-*`. */
export function withHostSurfaceVars(variables: Record<string, string>): Record<string, string> {
  const wrap = (sdkVar: string, fallback: string) => `var(${sdkVar}, ${fallback})`;
  return {
    ...variables,
    "--gafa-color-text": wrap(HOST_SDK_VARS.text, variables["--gafa-color-text"] ?? ""),
    "--gafa-color-background": wrap(HOST_SDK_VARS.background, variables["--gafa-color-background"] ?? ""),
    "--gafa-color-surface": wrap(HOST_SDK_VARS.surface, variables["--gafa-color-surface"] ?? ""),
    "--gafa-color-surface-raised": wrap(
      HOST_SDK_VARS.surfaceRaised,
      variables["--gafa-color-surface-raised"] ?? "",
    ),
    "--gafa-color-border": wrap(HOST_SDK_VARS.border, variables["--gafa-color-border"] ?? ""),
    "--gafa-color-overlay": wrap(HOST_SDK_VARS.overlay, variables["--gafa-color-overlay"] ?? ""),
    "--gafa-color-input-background": wrap(
      HOST_SDK_VARS.surfaceRaised,
      variables["--gafa-color-input-background"] ?? variables["--gafa-color-surface"] ?? "",
    ),
    "--gafa-color-input-text": wrap(HOST_SDK_VARS.text, variables["--gafa-color-input-text"] ?? ""),
    "--gafa-color-input-border": wrap(HOST_SDK_VARS.border, variables["--gafa-color-input-border"] ?? ""),
  };
}

type HostSchemeListener = () => void;

const hostSchemeListeners = new Set<HostSchemeListener>();
let hostWatchers = 0;
let patchedSetItem: typeof Storage.prototype.setItem | null = null;
let nativeSetItem: typeof Storage.prototype.setItem | null = null;

function notifyHostSchemeListeners() {
  hostSchemeListeners.forEach((listener) => listener());
}

function isHostThemeStorageKey(key: string) {
  return (HOST_THEME_STORAGE_KEYS as readonly string[]).includes(key);
}

/**
 * Observa clase/`data-theme` y el `localStorage` de Fitspin en la misma pestaña
 * (`storage` solo dispara en otras). Varios ThemeProvider comparten el parche.
 */
export function watchHostColorScheme(onChange: HostSchemeListener, root: Document = document): () => void {
  hostSchemeListeners.add(onChange);

  if (hostWatchers === 0 && typeof Storage !== "undefined") {
    nativeSetItem = Storage.prototype.setItem;
    patchedSetItem = function (this: Storage, key: string, value: string) {
      nativeSetItem!.call(this, key, value);
      if (isHostThemeStorageKey(String(key))) notifyHostSchemeListeners();
    };
    Storage.prototype.setItem = patchedSetItem;
  }
  hostWatchers += 1;

  const observer =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(onChange);
  const options: MutationObserverInit = {
    attributes: true,
    attributeFilter: ["class", "data-theme", "data-color-scheme", "data-bs-theme", "data-mode", "data-scheme"],
  };
  observer?.observe(root.documentElement, options);
  if (root.body) observer?.observe(root.body, options);

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onChange);
  }

  return () => {
    hostSchemeListeners.delete(onChange);
    observer?.disconnect();
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onChange);
    }
    hostWatchers = Math.max(0, hostWatchers - 1);
    if (hostWatchers === 0 && nativeSetItem && typeof Storage !== "undefined") {
      if (Storage.prototype.setItem === patchedSetItem) {
        Storage.prototype.setItem = nativeSetItem;
      }
      nativeSetItem = null;
      patchedSetItem = null;
    }
  };
}
