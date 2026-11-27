import { useEffect, useId, useRef, type ReactNode } from "react";
import { firstFocusable, trapTabKey } from "./focusTrap";

export type ConfirmDialogProps = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` para acciones que destruyen algo (cancelar una clase). */
  tone?: "danger" | "default";
  busy?: boolean;
  busyLabel?: string;
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
  busyLabel = "Un momento…",
  error,
  onConfirm,
  onDismiss,
}: ConfirmDialogProps) {
  const descriptionId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const interaction = useRef({ busy, onDismiss });
  interaction.current = { busy, onDismiss };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!interaction.current.busy) interaction.current.onDismiss();
      } else if (event.key === "Tab") {
        trapTabKey(dialog, event);
        event.stopImmediatePropagation();
      }
    };
    // The confirmation can be layered over a sheet with its own key handler.
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      previous?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const confirm = confirmRef.current;
    const initialFocus = confirm && !confirm.disabled ? confirm : firstFocusable(dialog) ?? dialog;
    initialFocus.focus({ preventScroll: true });
  }, [busy]);

  return (
    <div
      className="gafa-confirm-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onDismiss();
      }}
    >
      <div
        className="gafa-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy || undefined}
        data-tone={tone}
        tabIndex={-1}
        ref={dialogRef}
      >
        <span className="gafa-confirm__mark" aria-hidden="true">
          {tone === "danger" ? <DangerMarkIcon /> : <HelpMarkIcon />}
        </span>
        <h3 className="gafa-confirm__title">{title}</h3>
        {description ? <p id={descriptionId} className="gafa-confirm__text">{description}</p> : null}
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
            {busy ? busyLabel : confirmLabel}
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
