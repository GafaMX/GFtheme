import { describe, expect, it } from "vitest";
import { buildThumbnailUrl, canBuildThumbnail, isTransformableSource, resolveImagesConfig } from "./imageProxy";

const COACH_PHOTO =
  "https://buqstorage.blob.core.windows.net/buq-imagenes/public/prod-server/80/applibreriascatalogtablesbrandcatalogstaff/2847/picture_web.jpg";

describe("resolveImagesConfig", () => {
  it("usa el origen de la API como zona de transformaciones", () => {
    expect(resolveImagesConfig(undefined, "https://buq.partners")).toEqual({
      provider: "cloudflare",
      transformBaseUrl: "https://buq.partners",
    });
  });

  it("ignora el path de la API: la zona es solo el origen", () => {
    expect(resolveImagesConfig(undefined, "https://buq.partners/api/v2/").transformBaseUrl).toBe(
      "https://buq.partners",
    );
  });

  it("respeta una zona propia y le quita la diagonal final", () => {
    expect(resolveImagesConfig({ transformBaseUrl: "https://img.buq.partners/" }, "https://buq.partners")).toEqual({
      provider: "cloudflare",
      transformBaseUrl: "https://img.buq.partners",
    });
  });

  it("se apaga si la URL de la API no es valida y no hay zona explicita", () => {
    expect(resolveImagesConfig(undefined, "no-es-una-url").provider).toBe("none");
  });

  it("se puede apagar a mano", () => {
    expect(resolveImagesConfig({ provider: "none" }, "https://buq.partners").provider).toBe("none");
  });
});

describe("buildThumbnailUrl", () => {
  const config = resolveImagesConfig(undefined, "https://buq.partners");

  it("arma la URL de Cloudflare con la original concatenada sin encodear", () => {
    expect(buildThumbnailUrl(COACH_PHOTO, { width: 72, height: 72, gravity: "face" }, config)).toBe(
      `https://buq.partners/cdn-cgi/image/width=72,height=72,fit=cover,gravity=face,quality=78,format=auto,metadata=none/${COACH_PHOTO}`,
    );
  });

  it("acepta solo el alto y no manda gravity cuando no recorta", () => {
    expect(buildThumbnailUrl(COACH_PHOTO, { height: 84, fit: "scale-down" }, config)).toBe(
      `https://buq.partners/cdn-cgi/image/height=84,fit=scale-down,quality=78,format=auto,metadata=none/${COACH_PHOTO}`,
    );
  });

  it("redondea las medidas para no generar variantes de mas", () => {
    expect(buildThumbnailUrl(COACH_PHOTO, { width: 71.6 }, config)).toContain("width=72,");
  });

  it("no transforma si no se pidio ninguna medida", () => {
    expect(buildThumbnailUrl(COACH_PHOTO, {}, config)).toBeNull();
  });

  it("no transforma sin proveedor", () => {
    const off = resolveImagesConfig({ provider: "none" }, "https://buq.partners");
    expect(buildThumbnailUrl(COACH_PHOTO, { width: 72 }, off)).toBeNull();
  });

  it("no transforma una imagen que ya viene transformada", () => {
    const already = `https://buq.partners/cdn-cgi/image/width=72/${COACH_PHOTO}`;
    expect(buildThumbnailUrl(already, { width: 72 }, config)).toBeNull();
  });

  it.each(["", null, undefined])("no transforma un origen vacio (%s)", (source) => {
    expect(buildThumbnailUrl(source, { width: 72 }, config)).toBeNull();
  });
});

describe("isTransformableSource", () => {
  it.each([
    ["https://buqstorage.blob.core.windows.net/foto.jpg", true],
    ["http://gafa.fit/foto.jpg", true],
    ["//buqstorage.blob.core.windows.net/foto.jpg", false],
    ["/uploads/foto.jpg", false],
    ["data:image/png;base64,iVBORw0KGgo=", false],
    ["blob:https://buq.partners/1234", false],
  ])("%s -> %s", (source, expected) => {
    expect(isTransformableSource(source)).toBe(expected);
  });
});

describe("canBuildThumbnail", () => {
  const config = resolveImagesConfig(undefined, "https://buq.partners");

  it("coincide con lo que hace buildThumbnailUrl", () => {
    expect(canBuildThumbnail(COACH_PHOTO, config)).toBe(true);
    expect(canBuildThumbnail("/uploads/foto.jpg", config)).toBe(false);
    expect(canBuildThumbnail(null, config)).toBe(false);
  });
});
