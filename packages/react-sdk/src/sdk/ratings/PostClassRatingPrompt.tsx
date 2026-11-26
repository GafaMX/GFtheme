import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { GafaClient, UserReservation } from "../client/types";
import { ClassRatingDialog } from "./ClassRatingDialog";
import {
  classRatingIsComplete,
  enabledRatingStars,
  pickPromptReservation,
  ratingPromptStorageKey,
  type ClassRatingsConfig,
} from "./classRatings";

export function PostClassRatingPrompt({
  client,
  companyId,
  history,
  config,
  loading,
  onDismissFocus,
}: {
  client: GafaClient;
  companyId?: number;
  history: UserReservation[];
  config: ClassRatingsConfig;
  loading: boolean;
  onDismissFocus(): void;
}) {
  const candidates = useMemo(() => history.filter((row) => !row.cancelled && !row.isWaitlist).slice(0, 5), [history]);
  const ratingQueries = useQueries({
    queries: candidates.map((reservation) => ({
      queryKey: ["profile", "rating", reservation.brandSlug, reservation.id],
      queryFn: async () => {
        if (!client.getReservationRating) return null;
        return client.getReservationRating(reservation.brandSlug, reservation.id);
      },
      enabled: Boolean(client.getReservationRating) && !loading && config.promptAfterClass,
    })),
  });

  const ratedIds = useMemo(() => {
    const ids: number[] = [];
    candidates.forEach((reservation, index) => {
      if (classRatingIsComplete(ratingQueries[index]?.data, config)) ids.push(reservation.id);
    });
    return ids;
  }, [candidates, ratingQueries, config]);

  const target = useMemo(() => pickPromptReservation(history, ratedIds), [history, ratedIds]);
  const [dismissed, setDismissed] = useState(false);
  const [dialogReservation, setDialogReservation] = useState<UserReservation | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!target || dialogReservation || confirmation) return;
    try {
      if (sessionStorage.getItem(ratingPromptStorageKey(companyId, target.id))) setDismissed(true);
    } catch {
      // sessionStorage puede fallar en iframe / modo privado
    }
  }, [companyId, target, dialogReservation, confirmation]);

  useEffect(() => {
    if (confirmation && !dialogReservation) doneRef.current?.focus({ preventScroll: true });
  }, [confirmation, dialogReservation]);

  if (!config.promptAfterClass || dismissed) return null;

  const offeredReservation = dialogReservation ?? target;
  const waitingForRatings = loading || ratingQueries.some((query) => query.isLoading);
  if (!confirmation && !dialogReservation && (!target || waitingForRatings)) return null;

  function markSeen(reservationId: number) {
    try {
      sessionStorage.setItem(ratingPromptStorageKey(companyId, reservationId), "1");
    } catch {
      // sessionStorage puede fallar en iframe / modo privado
    }
  }

  function dismiss() {
    if (!confirmation && offeredReservation) markSeen(offeredReservation.id);
    setDismissed(true);
    onDismissFocus();
  }

  return (
    <>
      <aside className="gafa-rating-notice" aria-label={confirmation ? undefined : "Califica tu última clase"}>
        {confirmation ? (
          <p className="gafa-rating-notice__text" ref={doneRef} role="status" tabIndex={-1}>
            {confirmation}
          </p>
        ) : offeredReservation ? (
          <p className="gafa-rating-notice__text">
            <span className="gafa-rating-notice__kicker">Tu última clase</span>
            <strong>
              {offeredReservation.serviceName}
              {offeredReservation.staffName ? ` con ${offeredReservation.staffName}` : ""}
            </strong>
          </p>
        ) : null}
        <div className="gafa-rating-notice__actions">
          {!confirmation && offeredReservation ? (
            <button
              className="gafa-sdk-button gafa-rating-cta"
              type="button"
              aria-haspopup="dialog"
              onClick={() => setDialogReservation(offeredReservation)}
            >
              <span aria-hidden="true">★</span> Calificar
            </button>
          ) : null}
          <button
            className="gafa-rating-notice__dismiss"
            type="button"
            aria-label={confirmation ? "Cerrar confirmación" : "Ahora no"}
            onClick={dismiss}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </aside>
      {dialogReservation ? (
        <ClassRatingDialog
          client={client}
          reservation={dialogReservation}
          config={config}
          onClose={() => setDialogReservation(null)}
          onSubmitted={(rating) => {
            markSeen(dialogReservation.id);
            const { classStars, staffStars } = enabledRatingStars(rating, config);
            const staffName = dialogReservation.staffName?.trim();
            if (classStars != null) {
              const coach = staffStars != null ? ` · coach ★ ${staffStars}` : "";
              setConfirmation(`¡Gracias! Calificaste ${dialogReservation.serviceName} ★ ${classStars}${coach}`);
            } else if (staffStars != null) {
              setConfirmation(`¡Gracias! Calificaste ${staffName ? `a ${staffName}` : "al coach"} ★ ${staffStars}`);
            } else {
              setConfirmation("¡Gracias por calificar!");
            }
          }}
        />
      ) : null}
    </>
  );
}
