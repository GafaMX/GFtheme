/**
 * Atributos WP/Elementor `filter-bq-*`.
 * Servicio y coach van ON aunque el shortcode no los declare (Fitspin y
 * casi todo estudio los esperan). Marca/sala siguen opt-in.
 */
export function readFilterFlag(element: Element, name: string, defaultOn: boolean): boolean {
  if (!element.hasAttribute(name)) return defaultOn;
  const value = (element.getAttribute(name) ?? "").trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off" || value === "no") return false;
  return true;
}
