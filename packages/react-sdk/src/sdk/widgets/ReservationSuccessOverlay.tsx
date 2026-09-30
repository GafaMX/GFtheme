import { CloseIcon } from "./sdkIcons";
import { SdkBodyOverlay } from "./SdkBodyOverlay";

export type ReservationSuccessOverlayProps = {
  className: string;
  when?: string;
  coach?: string;
  isWaitlist?: boolean;
  creditName?: string;
  creditKind?: "credit" | "membership";
  remainingBefore?: number;
  onClose: () => void;
};

/**
 * Confirmación compacta después de reservar desde Concierge (sin reabrir el
 * flujo de mapa/créditos). Reusa las clases `gafa-reservation-success`.
 */
export function ReservationSuccessOverlay({
  className,
  when,
  coach,
  isWaitlist,
  creditName,
  creditKind,
  remainingBefore,
  onClose,
}: ReservationSuccessOverlayProps) {
  const remainingAfter =
    creditKind === "credit" && typeof remainingBefore === "number"
      ? Math.max(0, remainingBefore - 1)
      : undefined;

  return (
    <SdkBodyOverlay
      className="gafa-reservation-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-success-title"
      data-gafa-reservation-success=""
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="gafa-reservation-sheet" data-step="done">
        <button className="gafa-reservation-close" type="button" aria-label="Cerrar" onClick={onClose}>
          <CloseIcon />
        </button>
        <div className="gafa-reservation-success">
          <span className="gafa-reservation-success__icon" aria-hidden="true">
            ✓
          </span>
          <h3 id="reservation-success-title">
            {isWaitlist ? "Estás en la lista de espera" : "¡Reserva confirmada!"}
          </h3>
          <p className="gafa-reservation-success__when">
            {className}
            {when ? ` · ${when}` : ""}
            {coach ? ` · ${coach}` : ""}
          </p>
          {creditName ? (
            <div className="gafa-reservation-success__card">
              <p>
                {creditKind === "membership" ? (
                  <>
                    Reservaste con tu membresía <strong>{creditName}</strong>.
                  </>
                ) : typeof remainingAfter === "number" ? (
                  <>
                    Usaste tu paquete <strong>{creditName}</strong>: te{" "}
                    {remainingAfter === 1 ? "queda" : "quedan"} <strong>{remainingAfter}</strong>{" "}
                    {remainingAfter === 1 ? "crédito" : "créditos"}.
                  </>
                ) : (
                  <>
                    Reservaste con tu paquete <strong>{creditName}</strong>.
                  </>
                )}
              </p>
            </div>
          ) : null}
          <button className="gafa-sdk-button gafa-reservation-success__done" type="button" onClick={onClose}>
            Listo
          </button>
        </div>
      </div>
    </SdkBodyOverlay>
  );
}
