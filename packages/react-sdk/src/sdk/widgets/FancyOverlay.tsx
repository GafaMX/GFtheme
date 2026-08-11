import { useEffect, useRef, useState } from "react";

export type FancyOverlayProps = {
  title: string;
  description?: string;
  run: () => Promise<void>;
  onClose: () => void;
};

type FancyStatus = "opening" | "ready" | "error";

const CONTENT_WAIT_TIMEOUT_MS = 8000;

/**
 * Contenedor moderno para el checkout "fancy": el formulario real lo sigue inyectando
 * el SDK externo de gafa.fit/GAFApay en [data-gf-theme="fancy"], esto solo controla el
 * trigger/overlay/estados. Reemplaza el polling infinito del legacy (setTimeout(getFancy, 1000)
 * sin limite) por una espera acotada con MutationObserver + timeout explicito.
 */
export function FancyOverlay({ title, description, run, onClose }: FancyOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);
  const [status, setStatus] = useState<FancyStatus>("opening");
  const [error, setError] = useState<string>();

  useEffect(() => {
    // El StrictMode de React invoca este effect dos veces en dev (mount->cleanup->mount),
    // SINCRONICAMENTE, antes de que corra cualquier microtask. run() dispara un side effect
    // real (mutar el DOM compartido [data-gf-theme="fancy"]), no es idempotente, asi que
    // startedRef evita la segunda llamada real a run(). A proposito NO usamos un flag
    // "cancelled" seteado en el cleanup: como el cleanup simulado de StrictMode corre antes
    // de que la promesa de run() se resuelva, ese flag siempre quedaria en true y el
    // resultado real (exito o error) se descartaria en silencio. React ya ignora setState
    // en un unmount de verdad, asi que no hace falta ese guard extra aqui.
    if (startedRef.current) return;
    startedRef.current = true;

    run()
      .then(() => {
        const container = containerRef.current;
        if (!container) return;
        return waitForFancyContent(container, CONTENT_WAIT_TIMEOUT_MS);
      })
      .then(() => setStatus("ready"))
      .catch((err: unknown) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "No se pudo abrir el checkout.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="gafa-reservation-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fancy-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* El sheet crece a pantalla ancha cuando el template ya cargo: el mapa
          de salon necesita espacio real, no una columna de 520px. */}
      <div className="gafa-reservation-sheet" data-fancy-ready={status === "ready" ? "true" : undefined}>
        <button className="gafa-reservation-close" type="button" aria-label="Cerrar checkout" onClick={onClose}>
          x
        </button>

        {status !== "ready" ? (
          <div className="gafa-reservation-hero">
            <span className="gafa-eyebrow">Checkout</span>
            <h3 id="fancy-title">{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
        ) : null}

        {status === "opening" ? <p className="gafa-sdk-state">Abriendo checkout...</p> : null}

        {status === "error" ? (
          <div className="gafa-sdk-state gafa-sdk-state--error">
            <p>{error}</p>
            <button className="gafa-sdk-button gafa-sdk-button--secondary" type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : null}

        <div data-gf-theme="fancy" ref={containerRef} className="gafa-fancy-mount" />
      </div>
    </div>
  );
}

function waitForFancyContent(container: Element, timeoutMs: number): Promise<void> {
  if (container.childElementCount > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error("El checkout no respondio a tiempo. Intenta de nuevo."));
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      if (container.childElementCount > 0) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(container, { childList: true });
  });
}
