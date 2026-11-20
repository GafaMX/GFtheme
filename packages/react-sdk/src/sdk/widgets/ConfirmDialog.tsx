import { useEffect, useRef, type ReactNode } from "react";

export type ConfirmDialogProps = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` para acciones que destruyen algo (cancelar una clase). */
  tone?: "danger" | "default";
  busy?: boolean;
  error?: string;
  onConfirm(): void;
  onDismiss(): void;
};

/**
 * Reemplaza a `window.confirm`: el nativo no se puede tematizar, muestra la URL
 * del sitio y en movil aparece pegado al borde superior del navegador.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Volver",
  tone = "default",
  busy = false,
  error,
  onConfirm,
  onDismiss,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    confirmRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onDismiss]);

  return (
    <div
      className="gafa-confirm-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onDismiss();
      }}
    >
      <div className="gafa-confirm" role="alertdialog" aria-modal="true" aria-label={title} data-tone={tone}>
        <span className="gafa-confirm__mark" aria-hidden="true">
          {tone === "danger" ? <DangerMarkIcon /> : <HelpMarkIcon />}
        </span>
        <h3 className="gafa-confirm__title">{title}</h3>
        {description ? <p className="gafa-confirm__text">{description}</p> : null}
        {error ? <p className="gafa-sdk-state gafa-sdk-state--error">{error}</p> : null}
        <div className="gafa-confirm__actions">
          <button
            className="gafa-sdk-button gafa-sdk-button--secondary"
            type="button"
            disabled={busy}
            onClick={onDismiss}
          >
            {cancelLabel}
          </button>
          <button
            className="gafa-sdk-button gafa-confirm__confirm"
            type="button"
            disabled={busy}
            onClick={onConfirm}
            ref={confirmRef}
          >
            {busy ? "Un momento…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function HelpMarkIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.7 9.2a3.3 3.3 0 1 1 4.6 3c-.9.5-1.4 1.1-1.4 2.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M12 17.4h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function DangerMarkIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7.2v6.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 17.4h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
