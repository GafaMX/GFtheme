/**
 * Atributos WP/Elementor `filter-bq-*`.
 * Servicio y coach van ON aunque el shortcode no los declare (Fitspin y
 * casi todo estudio los esperan). Marca/sala siguen opt-in.
 */
export function readFilterFlag(element: Element, name: string, defaultOn: boolean): boolean {
  if (!element.hasAttribute(name)) return defaultOn;
  return parseFilterFlagValue(element.getAttribute(name), defaultOn);
}

/**
 * Buq-Webs monta el calendario con `hasAttribute("filter-bq-service")`.
 * En Fitspin `/reservar` el HTML no declara servicio/staff, así que manda
 * `service: false` y tapaba el default ON del SDK. Un `false` booleano
 * se trata como “no dicho”. Solo `"false"` / `"0"` / `"off"` apagan.
 */
export function parseFilterFlagValue(value: boolean | string | undefined | null, defaultOn: boolean): boolean {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "off" || normalized === "no") return false;
    return true;
  }
  if (value === true) return true;
  return defaultOn;
}
