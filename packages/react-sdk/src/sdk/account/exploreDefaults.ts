/**
 * CTAs de los estados vacios de la cuenta (Reservar / Comprar).
 *
 * En el demo del SDK el sitio pasa onExploreClasses / onExplorePackages.
 * En Fitspin y el resto de sitios Fancy, openAccount() se llama sin esos
 * callbacks: si el boton depende de ellos, desaparece. Estos defaults
 * cierran el hueco: buscan el calendario o la seccion de paquetes que
 * el propio sitio ya tiene en el DOM.
 */

const ACCOUNT_CHROME = ".gafa-account-overlay, .gafa-checkout-overlay";

const CALENDAR_SELECTORS = [
  '[data-gf-theme="meetings-calendar"]',
  '[data-gafa-widget="calendar"]',
  "#calendario",
];

const PACKAGE_LINK_SELECTORS = [
  'a[href="#paquetes"]',
  'a[href="#packages"]',
  'a[href*="paquetes"]',
  'a[href*="packages"]',
];

const PACKAGE_SECTION_SELECTORS = [
  '[data-gf-theme="combo-list"]',
  '[data-gf-theme="membership-list"]',
  "#paquetes",
  "#packages",
];

function firstOutsideChrome(selectors: string[]): HTMLElement | null {
  if (typeof document === "undefined") return null;
  for (const selector of selectors) {
    const nodes = document.querySelectorAll<HTMLElement>(selector);
    for (const node of nodes) {
      if (node.closest(ACCOUNT_CHROME)) continue;
      return node;
    }
  }
  return null;
}

function scrollTo(element: HTMLElement) {
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function isPackagesHash(hash = typeof window !== "undefined" ? window.location.hash : "") {
  return /paquete|package|membres|compra/i.test(hash);
}

/** Cierra un hash de paquetes para que el calendario de la home vuelva a verse. */
function clearPackagesHash() {
  if (typeof window === "undefined" || !isPackagesHash(window.location.hash)) return;
  const url = `${window.location.pathname}${window.location.search}`;
  window.history.pushState("", document.title, url);
}

export function defaultExploreClasses() {
  if (typeof window === "undefined") return;
  clearPackagesHash();
  const calendar = firstOutsideChrome(CALENDAR_SELECTORS);
  if (calendar) {
    scrollTo(calendar);
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function defaultExplorePackages() {
  if (typeof window === "undefined") return;

  const nav = firstOutsideChrome(PACKAGE_LINK_SELECTORS);
  if (nav) {
    nav.click();
    return;
  }

  const section = firstOutsideChrome(PACKAGE_SECTION_SELECTORS);
  if (section) {
    scrollTo(section);
    return;
  }

  window.location.hash = "paquetes";
}
