import { useEffect, useRef, useState } from "react";
import type { GafaClient, UserReservation } from "../client/types";
import { ClassRatingDialog } from "./ClassRatingDialog";
import {
  CLASS_RATING_MAX,
  classRatingIsComplete,
  isReservationRateable,
  isValidStarValue,
  type ClassRating,
  type ClassRatingsConfig,
} from "./classRatings";
import { useReservationRating } from "./useReservationRating";

/** “Calificada ★ 5” (y ★ del coach solo si es distinta). */
export function ratedSummary(rating: ClassRating, config: ClassRatingsConfig): { text: string; label: string } {
  const classStars = config.rateClass && isValidStarValue(rating.classStars) ? rating.classStars : null;
  const staffStars = config.rateCoach && isValidStarValue(rating.staffStars) ? rating.staffStars : null;
  const first = classStars ?? staffStars;
  let text = `Calificada ★ ${first}`;
  let label = classStars != null ? `Calificada: clase ${classStars} de ${CLASS_RATING_MAX}` : `Calificada: coach ${staffStars} de ${CLASS_RATING_MAX}`;
  if (classStars != null && staffStars != null) {
    label += `, coach ${staffStars} de ${CLASS_RATING_MAX}`;
    if (classStars !== staffStars) text += ` · coach ★ ${staffStars}`;
  }
  return { text, label };
}

/**
 * Lo único que va en la tarjeta de una clase pasada: botón compacto
 * “Calificar” (abre el popup) o la línea corta “Calificada ★ 5”.
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
        role="status"
        aria-label={summary.label}
        tabIndex={-1}
        data-rated="true"
      >
        <span aria-hidden="true">{summary.text}</span>
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
