import React, { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import {
  buildThumbnailUrl,
  canBuildThumbnail,
  resolveImagesConfig,
  type ImagesConfig,
  type ResolvedImagesConfig,
  type ThumbnailOptions,
} from "./imageProxy";

const ImagesContext = createContext<ResolvedImagesConfig>({
  provider: "none",
  transformBaseUrl: "",
  // Sin provider, un widget montado fuera del SDK se comporta como antes de
  // esta capa en vez de quedarse sin imagenes.
  allowUnoptimizedOriginals: true,
});

export function ImagesProvider({
  children,
  images,
  apiBaseUrl,
}: {
  children: React.ReactNode;
  images?: ImagesConfig;
  apiBaseUrl: string;
}) {
  const value = useMemo(() => resolveImagesConfig(images, apiBaseUrl), [images, apiBaseUrl]);

  return <ImagesContext.Provider value={value}>{children}</ImagesContext.Provider>;
}

export function useImagesConfig(): ResolvedImagesConfig {
  return useContext(ImagesContext);
}

/**
 * Si la zona todavia no tiene activadas las Transformations, `/cdn-cgi/image/...`
 * responde 404 y las miniaturas no cargan. En vez de exigir que la integracion
 * lo configure a mano, el SDK lo detecta: la primera miniatura que falle sin que
 * ninguna haya cargado antes apaga las transformaciones para toda la sesion, y
 * cada imagen vuelve a su comportamiento de respaldo.
 *
 * Una vez que UNA miniatura carga bien, el estado queda en `ok` y ya no se apaga:
 * a partir de ahi un error es una imagen rota puntual (una foto borrada del
 * storage), no un problema de la zona.
 */
type TransformSupport = "unknown" | "ok" | "unsupported";

const SESSION_KEY = "gafa-sdk-image-transforms";

let support: TransformSupport = readStoredSupport();
const listeners = new Set<() => void>();

function readStoredSupport(): TransformSupport {
  if (typeof sessionStorage === "undefined") return "unknown";
  const stored = sessionStorage.getItem(SESSION_KEY);
  return stored === "ok" || stored === "unsupported" ? stored : "unknown";
}

function setSupport(next: TransformSupport) {
  if (support === next) return;
  support = next;
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(SESSION_KEY, next);
    } catch {
      // Modo privado sin storage: el estado igual vive en memoria.
    }
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTransformSupport(): TransformSupport {
  return useSyncExternalStore(
    subscribe,
    () => support,
    () => "unknown" as const,
  );
}

/** Solo para tests: vuelve el detector a cero. */
export function resetTransformSupport() {
  support = "unknown";
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SESSION_KEY);
  listeners.forEach((listener) => listener());
}

/**
 * Si una `RemoteImage` con estas mismas condiciones va a pintar algo. Sirve para
 * que el layout que rodea a la imagen (por ejemplo el hueco que le deja la
 * tarjeta del calendario) no reserve espacio para una foto que no se va a ver.
 */
export function useRemoteImageEnabled(
  src: string | null | undefined,
  whenUnavailable: "hide" | "original" = "hide",
): boolean {
  const config = useImagesConfig();
  const transformSupport = useTransformSupport();

  if (!src) return false;
  if (whenUnavailable === "original" || config.allowUnoptimizedOriginals) return true;

  return transformSupport !== "unsupported" && canBuildThumbnail(src, config);
}

export type RemoteImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & {
  src?: string | null;
  /** Lado en px CSS para imagenes cuadradas (avatares). */
  size?: number;
  width?: number;
  height?: number;
  fit?: ThumbnailOptions["fit"];
  gravity?: ThumbnailOptions["gravity"];
  quality?: number;
  /**
   * Que hacer cuando no hay miniatura disponible. `hide` es lo correcto para
   * imagenes decorativas (los avatares del calendario): mas vale no pintar la
   * foto que bajar 15 MB para un circulo de 36 px.
   */
  whenUnavailable?: "hide" | "original";
};

/**
 * Densidad fija de 2x en vez del DPR real del dispositivo: la URL queda igual
 * para todos los visitantes, asi el CDN cachea una sola variante y Cloudflare
 * cobra una sola transformacion unica por imagen.
 */
const PIXEL_DENSITY = 2;

export function RemoteImage({
  src,
  size,
  width,
  height,
  fit,
  gravity,
  quality,
  whenUnavailable = "hide",
  onError,
  onLoad,
  ...imgProps
}: RemoteImageProps) {
  const config = useImagesConfig();
  const transformSupport = useTransformSupport();
  const [broken, setBroken] = useState(false);

  const cssWidth = width ?? size;
  const cssHeight = height ?? size;

  const thumbnailUrl =
    transformSupport === "unsupported"
      ? null
      : buildThumbnailUrl(
          src,
          {
            width: cssWidth ? cssWidth * PIXEL_DENSITY : undefined,
            height: cssHeight ? cssHeight * PIXEL_DENSITY : undefined,
            fit,
            gravity,
            quality,
          },
          config,
        );

  const usesOriginalAsFallback = whenUnavailable === "original" || config.allowUnoptimizedOriginals;
  const finalSrc = thumbnailUrl ?? (usesOriginalAsFallback ? src : null);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (thumbnailUrl && support !== "ok") {
        // La zona no tiene Transformations: se apaga para toda la sesion y esta
        // misma imagen se vuelve a pintar con su respaldo.
        setSupport("unsupported");
      } else {
        setBroken(true);
      }
      onError?.(event);
    },
    [onError, thumbnailUrl],
  );

  const handleLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (thumbnailUrl) setSupport("ok");
      onLoad?.(event);
    },
    [onLoad, thumbnailUrl],
  );

  if (!src || !finalSrc || broken) return null;

  return (
    <img
      {...imgProps}
      src={finalSrc}
      width={cssWidth}
      height={cssHeight}
      loading={imgProps.loading ?? "lazy"}
      decoding={imgProps.decoding ?? "async"}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
}
