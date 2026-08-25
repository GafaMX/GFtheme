/**
 * CTAs de los estados vacios de la cuenta (Reservar / Comprar).
 *
 * En el demo del SDK el sitio pasa onExploreClasses / onExplorePackages.
 * En Fitspin, Voltio y el resto, openAccount() se llama sin esos callbacks:
 * Comprar tiene que abrir el fancy nativo (paquetes / membresías / productos),
 * no un #paquetes que en WordPress a menudo no existe.
 *
 * Reservar: si el calendario ya está en la pagina, hacemos scroll. Si no
 * (Fitspin home, etc.), hay que ir a `/reservar` — no al top de la misma URL.
 */

const ACCOUNT_CHROME = ".gafa-account-overlay, .gafa-checkout-overlay";

const CALENDAR_SELECTORS = [
  '[data-gf-theme="meetings-calendar"]',
  '[data-gafa-widget="calendar"]',
  "#calendario",
];

const RESERVE_PATH = "/reservar";

const RESERVE_LINK_SELECTORS = [
  'a[href="/reservar"]',
  'a[href$="/reservar"]',
  'a[href*="/reservar"]',
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

/**
 * Destino de Reservar cuando el calendario no está en esta pagina.
 * `null` = ya estamos en /reservar: solo hay que scrollear al top.
 */
export function reservePageHref(pathname: string, reserveLinkHref?: string | null): string | null {
  const href = reserveLinkHref?.trim();
  if (href && href !== "#" && !href.startsWith("#")) return href;
  if (/\/reservar\/?$/i.test(pathname)) return null;
  return RESERVE_PATH;
}

export function defaultExploreClasses() {
  if (typeof window === "undefined") return;
  clearPackagesHash();
  const calendar = firstOutsideChrome(CALENDAR_SELECTORS);
  if (calendar) {
    scrollTo(calendar);
    return;
  }
  const nav = firstOutsideChrome(RESERVE_LINK_SELECTORS);
  const href = reservePageHref(
    window.location.pathname,
    nav instanceof HTMLAnchorElement ? nav.getAttribute("href") : null,
  );
  if (href) {
    window.location.assign(href);
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

type CheckoutOpener = {
  openCheckout(options?: { skipCatalog?: boolean; brandSlug?: string }): unknown;
};

function nativeCheckout(): CheckoutOpener | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window as Window & { GafaThemeSDK?: CheckoutOpener; GafaSdk?: CheckoutOpener };
  return host.GafaThemeSDK ?? host.GafaSdk;
}

export function defaultExplorePackages() {
  if (typeof window === "undefined") return;

  const sdk = nativeCheckout();
  if (sdk && typeof sdk.openCheckout === "function") {
    sdk.openCheckout({ skipCatalog: false });
    return;
  }

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
