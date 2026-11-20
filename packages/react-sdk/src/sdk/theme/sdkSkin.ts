import type { CSSProperties } from "react";

export type SdkSkin = {
  scheme: string;
  style?: CSSProperties;
};

/**
 * Copia el esquema y las variables de `.gafa-sdk` para un nodo que se porta
 * a `document.body`. Elementor a veces pone `transform` en un ancestro y
 * entonces `position:fixed` deja de ser el viewport.
 */
export function copySdkSkin(from: Element | null): SdkSkin {
  const scheme = from?.getAttribute("data-color-scheme") ?? "dark";
  if (!(from instanceof HTMLElement) || from.style.length === 0) {
    return { scheme };
  }
  const style: Record<string, string> = {};
  for (const prop of from.style) {
    style[prop] = from.style.getPropertyValue(prop);
  }
  return { scheme, style: style as CSSProperties };
}
