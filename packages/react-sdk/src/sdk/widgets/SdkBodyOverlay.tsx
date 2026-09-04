import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { copySdkSkin } from "../theme/sdkSkin";

type SdkBodyOverlayProps = HTMLAttributes<HTMLDivElement> & {
  /** Default on: el fondo de la pagina no debe scrollear debajo del fancy. */
  lockScroll?: boolean;
};

/**
 * Overlay de reserva / login / checkout / cuenta. Siempre va a
 * `document.body` con la piel del `.gafa-sdk` mas cercano: si se queda
 * dentro del calendario, Elementor o un `transform` del host lo centran
 * solo en esa seccion.
 */
export function SdkBodyOverlay({
  className,
  children,
  lockScroll = true,
  style,
  ...rest
}: SdkBodyOverlayProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [skin, setSkin] = useState<SdkSkinState>({ scheme: "dark" });

  useLayoutEffect(() => {
    const root =
      anchorRef.current?.closest(".gafa-sdk") ?? document.querySelector(".gafa-sdk");
    setSkin(copySdkSkin(root));
  }, []);

  useEffect(() => {
    if (!lockScroll) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [lockScroll]);

  const node = (
    <div
      className={["gafa-sdk", className].filter(Boolean).join(" ")}
      data-color-scheme={skin.scheme}
      style={{ ...skin.style, ...style }}
      {...rest}
    >
      {children}
    </div>
  );

  return (
    <>
      <span ref={anchorRef} data-gafa-overlay-anchor="" hidden />
      {typeof document !== "undefined" ? createPortal(node, document.body) : node}
    </>
  );
}

type SdkSkinState = {
  scheme: string;
  style?: CSSProperties;
};
