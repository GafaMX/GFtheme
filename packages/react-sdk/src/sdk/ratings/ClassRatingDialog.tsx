import { useCallback, useEffect, useId, useRef } from "react";
import type { GafaClient, UserReservation } from "../client/types";
import { SdkBodyOverlay } from "../widgets/SdkBodyOverlay";
import { ClassRatingForm } from "./ClassRatingForm";
import type { ClassRating, ClassRatingsConfig } from "./classRatings";

export type ClassRatingDialogProps = {
  client: GafaClient;
  reservation: UserReservation;
  config: ClassRatingsConfig;
  onClose(): void;
  onSubmitted?(rating: ClassRating): void;
};

const FOCUSABLE =
  'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Popup para calificar una clase. Hoja inferior en móvil, modal centrado en
 * escritorio. Se cierra con la X, Cancelar, tocando fuera o con Escape; el
 * foco queda atrapado adentro y vuelve al botón que lo abrió.
 */
export function ClassRatingDialog({ client, reservation, config, onClose, onSubmitted }: ClassRatingDialogProps) {
  const kickerId = useId();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    if (!pendingRef.current) onCloseRef.current();
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    sheet?.focus({ preventScroll: true });

    const focusables = () =>
      Array.from(sheet?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.tabIndex >= 0 && (el.offsetParent !== null || el === document.activeElement),
      );

    // Captura en window: el Escape no llega al popup de Mi cuenta de abajo.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !sheet) return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        sheet.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === sheet || !sheet.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !sheet.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (sheet && event.target instanceof Node && !sheet.contains(event.target)) {
        const items = focusables();
        (items[0] ?? sheet).focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [requestClose]);

  return (
    <SdkBodyOverlay
      className="gafa-rating-dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={sheetRef}
        className="gafa-rating-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${kickerId} ${titleId}`}
        tabIndex={-1}
      >
        <span className="gafa-rating-dialog__handle" aria-hidden="true" />
        <button className="gafa-rating-dialog__close" type="button" aria-label="Cerrar" onClick={requestClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <p className="gafa-rating-dialog__kicker" id={kickerId}>
          Calificar clase
        </p>
        <h2 className="gafa-rating-dialog__heading" id={titleId}>
          {reservation.serviceName}
          {reservation.staffName ? <span> con {reservation.staffName}</span> : null}
        </h2>
        <ClassRatingForm
          client={client}
          reservation={reservation}
          config={config}
          onCancel={requestClose}
          onPendingChange={(pending) => {
            pendingRef.current = pending;
          }}
          onSubmitted={(rating) => {
            pendingRef.current = false;
            onSubmitted?.(rating);
            onCloseRef.current();
          }}
        />
      </div>
    </SdkBodyOverlay>
  );
}
