import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { GafaClient, UserReservation } from "../client/types";
import { ClassRatingDialog } from "./ClassRatingDialog";
import {
  classRatingIsComplete,
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
}: {
  client: GafaClient;
  companyId?: number;
  history: UserReservation[];
  config: ClassRatingsConfig;
  loading: boolean;
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!target) return;
    try {
      if (sessionStorage.getItem(ratingPromptStorageKey(companyId, target.id))) setDismissed(true);
    } catch {
      // sessionStorage puede fallar en iframe / modo privado
    }
  }, [companyId, target]);

  if (!config.promptAfterClass || loading || dismissed || !target) return null;
  if (ratingQueries.some((query) => query.isLoading)) return null;

  function dismiss() {
    if (target) {
      try {
        sessionStorage.setItem(ratingPromptStorageKey(companyId, target.id), "1");
      } catch {
        // ignore
      }
    }
    setOpen(false);
    setDismissed(true);
  }

  return (
    <>
      <aside className="gafa-rating-notice" aria-label="Califica tu última clase">
        <p className="gafa-rating-notice__text">
          <span className="gafa-rating-notice__kicker">Tu última clase</span>
          <strong>
            {target.serviceName}
            {target.staffName ? ` con ${target.staffName}` : ""}
          </strong>
        </p>
        <div className="gafa-rating-notice__actions">
          <button
            className="gafa-sdk-button gafa-rating-cta"
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            <span aria-hidden="true">★</span> Calificar
          </button>
          <button className="gafa-rating-notice__dismiss" type="button" aria-label="Ahora no" onClick={dismiss}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </aside>
      {open ? (
        <ClassRatingDialog
          client={client}
          reservation={target}
          config={config}
          onClose={() => setOpen(false)}
          onSubmitted={dismiss}
        />
      ) : null}
    </>
  );
}
