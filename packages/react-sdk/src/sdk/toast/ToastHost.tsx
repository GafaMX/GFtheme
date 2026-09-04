import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { copySdkSkin, type SdkSkin } from "../theme/sdkSkin";
import { dismissToast, getToasts, subscribeToasts } from "./toastStore";

const AUTO_DISMISS_MS = 4800;

/** Solo un portal: hay varios AuthWidget / ThemeProvider en roots distintos. */
let hostClaimed = false;

export function resetToastHostForTests() {
  hostClaimed = false;
}

/**
 * Notificaciones tipo Mac, arriba a la derecha, encima del checkout.
 * Prueba actual: solo login/registro las disparan.
 */
export function ToastHost() {
  const [owned, setOwned] = useState(false);
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  const [skin, setSkin] = useState<SdkSkin>({ scheme: "dark" });

  useEffect(() => {
    if (hostClaimed) return;
    hostClaimed = true;
    setOwned(true);
    return () => {
      hostClaimed = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!owned) return;
    const root = document.querySelector(".gafa-sdk");
    setSkin(copySdkSkin(root));
  }, [owned, toasts]);

  useEffect(() => {
    if (!owned || toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [owned, toasts]);

  if (!owned || typeof document === "undefined" || toasts.length === 0) return null;

  return createPortal(
    <div
      className="gafa-sdk gafa-toast-stack"
      data-color-scheme={skin.scheme}
      style={skin.style}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="gafa-toast" data-tone={toast.tone} role="alert">
          <span className="gafa-toast__bar" aria-hidden="true" />
          <p className="gafa-toast__message">{toast.message}</p>
          <button
            type="button"
            className="gafa-toast__close"
            aria-label="Cerrar aviso"
            onClick={() => dismissToast(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
