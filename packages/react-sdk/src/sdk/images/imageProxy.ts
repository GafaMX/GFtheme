/**
 * Miniaturas para las imagenes que suben las marcas (fotos de coach, foto de
 * perfil, lugares del mapa de salon).
 *
 * El problema que resuelve: gafa.fit guarda la imagen ORIGINAL tal cual se
 * subio, y las cinco "variantes" que expone la API (`picture_web`,
 * `picture_web_list`, `picture_web_over`, `picture_movil`, `picture_movil_list`)
 * son copias byte a byte del mismo archivo -- se verifico contra produccion
 * comparando Content-MD5 de los 103 coaches con foto de Fitspin. Ninguna esta
 * redimensionada. Hay fotos de coach de 15 MB (4000x6000 px) que el calendario
 * pinta en un circulo de 36 px: una semana de calendario llega a descargar
 * ~110 MB solo en avatares.
 *
 * La solucion sin tocar gafa.fit: pedir la imagen a traves de las
 * Transformations de Cloudflare, que ya esta en la ruta de red porque el dominio
 * de la API (buq.partners) es una zona de Cloudflare. La misma foto de 15 MB
 * sale en ~2 KB a 144 px.
 *
 * Requiere UNA configuracion de una sola vez en el dashboard de Cloudflare
 * (Images > Transformations): activar la zona y agregar
 * `*.blob.core.windows.net` como origen permitido. Mientras eso no este hecho,
 * `/cdn-cgi/image/...` responde 404 y el SDK se da cuenta solo (ver
 * `ImagesProvider`).
 */

export type ImageTransformProvider = "cloudflare" | "none";

export type ImagesConfig = {
  provider?: ImageTransformProvider;
  /**
   * Zona de Cloudflare que sirve las transformaciones. Si se omite se usa el
   * origen de `apiBaseUrl`, que es justo la zona que ya esta en Cloudflare.
   */
  transformBaseUrl?: string;
  /**
   * Escotilla de salida: pinta la imagen original cuando no hay miniatura, en
   * vez de esconderla. Es el comportamiento anterior a esta capa, util para una
   * marca que sepa que sus fotos son chicas. Ojo: es justo lo que hace que el
   * calendario descargue 15 MB por coach en marcas como Fitspin.
   */
  allowUnoptimizedOriginals?: boolean;
};

export type ResolvedImagesConfig = {
  provider: ImageTransformProvider;
  transformBaseUrl: string;
  allowUnoptimizedOriginals: boolean;
};

export type ThumbnailOptions = {
  /**
   * Medidas pedidas en pixeles reales (ya multiplicadas por el DPR). Basta con
   * una de las dos: con solo el alto, Cloudflare respeta la proporcion.
   */
  width?: number;
  height?: number;
  fit?: "cover" | "scale-down" | "contain";
  /** `face` recorta a la cara: es lo que queremos en los avatares de coach. */
  gravity?: "face" | "auto" | "center";
  quality?: number;
};

export function resolveImagesConfig(images: ImagesConfig | undefined, apiBaseUrl: string): ResolvedImagesConfig {
  const provider = images?.provider ?? "cloudflare";
  const transformBaseUrl = trimSlashes(images?.transformBaseUrl ?? originOf(apiBaseUrl));

  return {
    provider: transformBaseUrl ? provider : "none",
    transformBaseUrl,
    allowUnoptimizedOriginals: images?.allowUnoptimizedOriginals ?? false,
  };
}

/**
 * Devuelve la URL de la miniatura, o `null` si esta imagen no se puede
 * transformar (no hay proveedor, la URL no es absoluta, o ya viene transformada).
 * `null` NO significa error: significa "usa la original o no la pintes", y esa
 * decision es de quien llama.
 */
export function buildThumbnailUrl(
  source: string | null | undefined,
  options: ThumbnailOptions,
  config: ResolvedImagesConfig,
): string | null {
  if (!canBuildThumbnail(source, config)) return null;
  if (!options.width && !options.height) return null;

  // El path de Cloudflare NO va url-encoded: la URL original se concatena tal
  // cual despues de los parametros.
  return `${config.transformBaseUrl}/cdn-cgi/image/${cloudflareParams(options)}/${source}`;
}

/** Si esta imagen tendria miniatura, sin construir la URL. */
export function canBuildThumbnail(source: string | null | undefined, config: ResolvedImagesConfig): boolean {
  if (!source || config.provider === "none" || !config.transformBaseUrl) return false;
  return isTransformableSource(source);
}

/**
 * Solo se transforman URLs absolutas http(s). Un `data:`/`blob:` ya vive en el
 * navegador, y una ruta relativa apunta al sitio del socio, no a gafa.fit.
 */
export function isTransformableSource(source: string): boolean {
  if (!/^https?:\/\//i.test(source)) return false;
  if (source.includes("/cdn-cgi/image/")) return false;
  return true;
}

function cloudflareParams(options: ThumbnailOptions): string {
  const params = [
    options.width ? `width=${Math.round(options.width)}` : null,
    options.height ? `height=${Math.round(options.height)}` : null,
    `fit=${options.fit ?? "cover"}`,
    options.fit === "cover" || options.fit === undefined ? `gravity=${options.gravity ?? "auto"}` : null,
    `quality=${options.quality ?? 78}`,
    // `auto` entrega AVIF/WebP segun lo que soporte el navegador.
    "format=auto",
    // Sin EXIF: en una foto de celular son decenas de KB, mas que la miniatura.
    "metadata=none",
  ];

  return params.filter(Boolean).join(",");
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function trimSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}
