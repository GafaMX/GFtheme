import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImagesProvider, RemoteImage, resetTransformSupport } from "./ImagesProvider";

const COACH_PHOTO =
  "https://buqstorage.blob.core.windows.net/buq-imagenes/public/prod-server/80/applibreriascatalogtablesbrandcatalogstaff/2847/picture_web.jpg";

function renderAvatar(props: Partial<React.ComponentProps<typeof RemoteImage>> = {}) {
  return render(
    <ImagesProvider apiBaseUrl="https://buq.partners">
      <RemoteImage src={COACH_PHOTO} size={36} gravity="face" alt="coach" {...props} />
    </ImagesProvider>,
  );
}

beforeEach(() => resetTransformSupport());
afterEach(() => {
  cleanup();
  resetTransformSupport();
});

describe("RemoteImage", () => {
  it("pide la miniatura al doble del tamano en pantalla, no el original", () => {
    renderAvatar();

    const img = screen.getByAltText("coach");
    expect(img.getAttribute("src")).toBe(
      `https://buq.partners/cdn-cgi/image/width=72,height=72,fit=cover,gravity=face,quality=78,format=auto,metadata=none/${COACH_PHOTO}`,
    );
    expect(img.getAttribute("width")).toBe("36");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
  });

  it("si la zona no transforma, esconde la foto decorativa en vez de bajar el original", () => {
    renderAvatar();

    fireEvent.error(screen.getByAltText("coach"));

    expect(screen.queryByAltText("coach")).toBeNull();
  });

  it("si la zona no transforma, las imagenes marcadas como necesarias caen al original", () => {
    renderAvatar({ whenUnavailable: "original" });

    fireEvent.error(screen.getByAltText("coach"));

    expect(screen.getByAltText("coach").getAttribute("src")).toBe(COACH_PHOTO);
  });

  it("apaga las transformaciones para toda la sesion con un solo fallo", () => {
    const { unmount } = renderAvatar();
    fireEvent.error(screen.getByAltText("coach"));
    unmount();

    renderAvatar({ whenUnavailable: "original" });

    expect(screen.getByAltText("coach").getAttribute("src")).toBe(COACH_PHOTO);
  });

  it("una foto rota despues de que las miniaturas ya funcionaron no apaga nada", () => {
    const primera = renderAvatar();
    fireEvent.load(screen.getByAltText("coach"));
    fireEvent.error(screen.getByAltText("coach"));
    expect(screen.queryByAltText("coach")).toBeNull();
    primera.unmount();

    renderAvatar();

    expect(screen.getByAltText("coach").getAttribute("src")).toContain("/cdn-cgi/image/");
  });

  it("no pinta nada cuando el coach no tiene foto", () => {
    renderAvatar({ src: undefined });

    expect(screen.queryByAltText("coach")).toBeNull();
  });

  it("con la escotilla de salida vuelve a pintar el original tal cual", () => {
    render(
      <ImagesProvider apiBaseUrl="https://buq.partners" images={{ provider: "none", allowUnoptimizedOriginals: true }}>
        <RemoteImage src={COACH_PHOTO} size={36} alt="coach" />
      </ImagesProvider>,
    );

    expect(screen.getByAltText("coach").getAttribute("src")).toBe(COACH_PHOTO);
  });

  it("sin proveedor no toca la URL de las imagenes que si deben verse", () => {
    render(
      <ImagesProvider apiBaseUrl="https://buq.partners" images={{ provider: "none" }}>
        <RemoteImage src={COACH_PHOTO} size={36} whenUnavailable="original" alt="logo" />
      </ImagesProvider>,
    );

    expect(screen.getByAltText("logo").getAttribute("src")).toBe(COACH_PHOTO);
  });
});
