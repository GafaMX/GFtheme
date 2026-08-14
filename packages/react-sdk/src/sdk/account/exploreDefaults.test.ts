import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultExploreClasses, defaultExplorePackages } from "./exploreDefaults";

describe("exploreDefaults", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.pushState("", document.title, "/");
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

  it("Comprar usa el link de PAQUETES del sitio si existe", () => {
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

  it("Comprar cae a #paquetes si el sitio no tiene seccion ni link", () => {
    defaultExplorePackages();
    expect(window.location.hash).toBe("#paquetes");
  });
});
