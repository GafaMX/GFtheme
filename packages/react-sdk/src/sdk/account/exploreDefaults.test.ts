import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultExploreClasses, defaultExplorePackages, reservePageHref } from "./exploreDefaults";

describe("exploreDefaults", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.pushState("", document.title, "/");
    delete (window as Window & { GafaThemeSDK?: unknown }).GafaThemeSDK;
    delete (window as Window & { GafaSdk?: unknown }).GafaSdk;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("Reservar hace scroll al calendario y quita el hash de paquetes", () => {
    window.history.pushState("", document.title, "/#paquetes");
    document.body.innerHTML = `<div data-gf-theme="meetings-calendar"></div>`;
    const calendar = document.querySelector<HTMLElement>("[data-gf-theme='meetings-calendar']")!;
    calendar.scrollIntoView = vi.fn();

    defaultExploreClasses();

    expect(window.location.hash).toBe("");
    expect(calendar.scrollIntoView).toHaveBeenCalled();
  });

  it("Reservar sin calendario en la pagina va a /reservar", () => {
    expect(reservePageHref("/")).toBe("/reservar");
    expect(reservePageHref("/fitspin")).toBe("/reservar");
    expect(reservePageHref("/reservar")).toBeNull();
    expect(reservePageHref("/reservar/")).toBeNull();
    expect(reservePageHref("/", "/reservar")).toBe("/reservar");
  });

  it("Reservar sin calendario navega a /reservar", () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { pathname: "/", hash: "", search: "", assign, href: "http://localhost/" });

    defaultExploreClasses();

    expect(assign).toHaveBeenCalledWith("/reservar");
  });

  it("Comprar abre el fancy nativo si el SDK está en la pagina", () => {
    const openCheckout = vi.fn();
    (window as Window & { GafaThemeSDK?: { openCheckout: typeof openCheckout } }).GafaThemeSDK = {
      openCheckout,
    };
    document.body.innerHTML = `<a href="#paquetes">PAQUETES</a>`;

    defaultExplorePackages();

    expect(openCheckout).toHaveBeenCalledWith({ skipCatalog: false });
  });

  it("Comprar usa el link de PAQUETES del sitio si no hay SDK", () => {
    const onClick = vi.fn();
    document.body.innerHTML = `<a href="#paquetes">PAQUETES</a>`;
    document.querySelector("a")!.addEventListener("click", (event) => {
      event.preventDefault();
      onClick();
    });

    defaultExplorePackages();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("Comprar no dispara un link que viva dentro del popup de cuenta", () => {
    document.body.innerHTML = `
      <div class="gafa-account-overlay"><a href="#paquetes">interno</a></div>
      <section data-gf-theme="combo-list"></section>
    `;
    const catalog = document.querySelector<HTMLElement>("[data-gf-theme='combo-list']")!;
    catalog.scrollIntoView = vi.fn();
    const overlayLink = document.querySelector("a")!;
    const onClick = vi.fn();
    overlayLink.addEventListener("click", onClick);

    defaultExplorePackages();

    expect(onClick).not.toHaveBeenCalled();
    expect(catalog.scrollIntoView).toHaveBeenCalled();
  });

  it("Comprar cae a #paquetes si el sitio no tiene seccion ni link ni SDK", () => {
    defaultExplorePackages();
    expect(window.location.hash).toBe("#paquetes");
  });
});
