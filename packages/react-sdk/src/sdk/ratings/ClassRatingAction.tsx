import { useEffect, useRef, useState } from "react";
import type { GafaClient, UserReservation } from "../client/types";
import { ClassRatingDialog } from "./ClassRatingDialog";
import {
  CLASS_RATING_MAX,
  classRatingIsComplete,
  enabledRatingStars,
  isReservationRateable,
  type ClassRating,
  type ClassRatingsConfig,
} from "./classRatings";
import { useReservationRating } from "./useReservationRating";

/** Una línea por nota y una lectura completa para el lector de pantalla. */
export function ratedSummary(rating: ClassRating, config: ClassRatingsConfig): { lines: string[]; label: string } {
  const { classStars, staffStars } = enabledRatingStars(rating, config);
  const lines: string[] = [];
  const scores: string[] = [];
  if (classStars != null) {
    lines.push(`Calificada ★ ${classStars}`);
    scores.push(`clase ${classStars} de ${CLASS_RATING_MAX}`);
  }
  if (staffStars != null) {
    lines.push(`Coach ★ ${staffStars}`);
    scores.push(`coach ${staffStars} de ${CLASS_RATING_MAX}`);
  }
  return { lines, label: `Calificada: ${scores.join(", ")}` };
}

/**
 * Lo único que va en la tarjeta de una clase pasada: botón compacto
 * “Calificar” (abre el popup) o el resumen de las notas guardadas.
 */
export function ClassRatingAction({
  client,
  reservation,
  config,
}: {
  client: GafaClient;
  reservation: UserReservation;
  config: ClassRatingsConfig;
}) {
  const ratingQuery = useReservationRating(client, reservation);
  const [open, setOpen] = useState(false);
  const [justRated, setJustRated] = useState(false);
  const doneRef = useRef<HTMLParagraphElement | null>(null);

  const saved = ratingQuery.data ?? null;
  const complete = classRatingIsComplete(saved, config);

  useEffect(() => {
    if (justRated && complete) doneRef.current?.focus({ preventScroll: true });
  }, [justRated, complete]);

  if (!isReservationRateable(reservation)) return null;
  if (!client.getReservationRating && !client.submitReservationRating) return null;

  if (ratingQuery.isLoading && !saved) {
    return <span className="gafa-skeleton gafa-rating-cta-boot" aria-hidden="true" />;
  }

  if (complete && saved) {
    const summary = ratedSummary(saved, config);
    return (
      <p
        ref={doneRef}
        className="gafa-rating-done"
        role={justRated ? "status" : undefined}
        tabIndex={-1}
        data-rated="true"
        onBlur={() => setJustRated(false)}
      >
        <span className="gafa-rating-done__lines" aria-hidden="true">
          {summary.lines.map((line) => <span key={line}>{line}</span>)}
        </span>
        <span className="gafa-sr-only">{summary.label}</span>
      </p>
    );
  }

  return (
    <>
      <button
        className="gafa-sdk-button gafa-sdk-button--secondary gafa-rating-cta"
        type="button"
        aria-haspopup="dialog"
        aria-label={`Calificar ${reservation.serviceName}`}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">★</span> Calificar
      </button>
      {open ? (
        <ClassRatingDialog
          client={client}
          reservation={reservation}
          config={config}
          onClose={() => setOpen(false)}
          onSubmitted={() => setJustRated(true)}
        />
      ) : null}
    </>
  );
}
