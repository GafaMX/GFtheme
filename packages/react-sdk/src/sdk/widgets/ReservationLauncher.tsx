import { useQuery } from "@tanstack/react-query";
import { ReservationFlow } from "./CalendarWidget";
import type { CaptchaProvider } from "../captcha/CaptchaProvider";
import type { GafaClient, Meeting } from "../client/types";

export type ReservationLauncherProps = {
  client: GafaClient;
  captcha?: CaptchaProvider;
  /** Id de la clase en gafa.fit (el mismo que usa el calendario). */
  meetingId: string | number;
  /** Opcionales: acotan la busqueda de la clase y evitan pedir marcas/sedes. */
  brandSlug?: string;
  locationSlug?: string;
  locationId?: string | number;
  /** Si el sitio ya tiene la clase, se abre sin pedirla otra vez. */
  meeting?: Meeting | null;
  onClose: () => void;
  onReserved?: () => void;
  onPurchased?: () => void;
};

/**
 * Reserva de una clase abierta desde fuera del calendario (por id): resuelve
 * la clase contra la API y de ahi en adelante es el mismo flujo que un clic en
 * el calendario.
 */
export function ReservationLauncher({
  client,
  captcha,
  meetingId,
  brandSlug,
  locationSlug,
  locationId,
  meeting: meetingProp,
  onClose,
  onReserved,
  onPurchased,
}: ReservationLauncherProps) {
  const meetingQuery = useQuery({
    queryKey: ["calendar", "meeting", String(meetingId), brandSlug ?? null, locationSlug ?? null],
    queryFn: () =>
      client.getMeeting!({
        meetingId,
        brandSlug,
        locationSlug,
        locationId,
      }),
    enabled: !meetingProp && Boolean(client.getMeeting),
    staleTime: 60_000,
    retry: 1,
  });

  const meeting = meetingProp ?? meetingQuery.data ?? null;

  if (meeting) {
    return (
      <ReservationFlow
        client={client}
        captcha={captcha}
        meeting={meeting}
        brandSlug={brandSlug}
        locationSlug={locationSlug}
        onClose={onClose}
        onReserved={onReserved}
        onPurchased={onPurchased}
      />
    );
  }

  const unsupported = !client.getMeeting;
  const failed = unsupported || meetingQuery.isError || meetingQuery.isFetched;

  return (
    <div
      className="gafa-reservation-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-launcher-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="gafa-reservation-sheet">
        <button className="gafa-reservation-close" type="button" aria-label="Cerrar" onClick={onClose}>
          x
        </button>

        {failed ? (
          <div className="gafa-reservation-hero">
            <span className="gafa-eyebrow">Reserva</span>
            <h3 id="reservation-launcher-title">No encontramos esa clase</h3>
            <p>Puede que ya no esté publicada o que sea de otra sede. Revísala en el calendario.</p>
          </div>
        ) : (
          <div className="gafa-reservation-hero" aria-busy="true" aria-live="polite">
            <span className="gafa-eyebrow">Reserva</span>
            <h3 id="reservation-launcher-title" className="gafa-sr-only">
              Abriendo tu clase…
            </h3>
            <span className="gafa-skeleton gafa-launcher-skel__title" aria-hidden="true" />
            <span className="gafa-skeleton gafa-skeleton--card" aria-hidden="true" />
            <span className="gafa-skeleton gafa-skeleton--card" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
