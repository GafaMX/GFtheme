import type { ColorScheme } from "./palette";

const ATTRS = ["data-theme", "data-color-scheme", "data-bs-theme", "data-mode", "data-scheme"] as const;

/** `html.fitspin-dark` (Buq-Webs) y otras marcas de oscuro/claro en class. */
const DARK_CLASS = /(^|[\s_-])dark([\s_-]|$)/i;
const LIGHT_CLASS = /(^|[\s_-])light([\s_-]|$)/i;

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

/**
 * Lee el theme que ya puso el sitio (Fitspin: `html.fitspin-dark`).
 * null = la página no declara nada; el SDK usa su THEME / default.
 */
export function readHostColorScheme(root: Document = document): ColorScheme | null {
  return schemeFromElement(root.documentElement) ?? schemeFromElement(root.body);
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
