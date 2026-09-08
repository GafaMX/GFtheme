import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { copySdkSkin } from "../theme/sdkSkin";
import { useGafaThemeOptional } from "../theme/theme";

type SdkBodyOverlayProps = HTMLAttributes<HTMLDivElement> & {
  /** Default on: el fondo de la pagina no debe scrollear debajo del fancy. */
  lockScroll?: boolean;
};

/**
 * Overlay de reserva / login / checkout / cuenta. Siempre va a
 * `document.body`. El scheme y las variables salen del ThemeProvider en el
 * primer render (el portal no hereda CSS del widget).
 */
export function SdkBodyOverlay({
  className,
  children,
  lockScroll = true,
  style,
  ...rest
}: SdkBodyOverlayProps) {
  const theme = useGafaThemeOptional();
  const themeSkin = theme
    ? { scheme: theme.scheme, style: theme.variables as CSSProperties }
    : null;
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [copied, setCopied] = useState<SdkSkinState | null>(null);

  useLayoutEffect(() => {
    if (themeSkin) return;
    const root =
      anchorRef.current?.closest(".gafa-sdk") ?? document.querySelector(".gafa-sdk");
    setCopied(copySdkSkin(root));
  }, [themeSkin]);

  useEffect(() => {
    if (!lockScroll) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [lockScroll]);

  const skin = themeSkin ?? copied ?? { scheme: "dark" };

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
