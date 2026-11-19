import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { GafaClient, UserReservation } from "../client/types";
import { SdkBodyOverlay } from "../widgets/SdkBodyOverlay";
import { ClassRatingForm } from "./ClassRatingForm";
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
    setDismissed(true);
  }

  return (
    <SdkBodyOverlay
      className="gafa-rating-prompt-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        className="gafa-rating-prompt"
        role="dialog"
        aria-modal="true"
        aria-label="Califica tu última clase"
      >
        <p className="gafa-rating-prompt__kicker">Tu última clase</p>
        <h2 className="gafa-rating-prompt__heading">
          {target.serviceName}
          {target.staffName ? <span> con {target.staffName}</span> : null}
        </h2>
        <ClassRatingForm
          client={client}
          reservation={target}
          config={config}
          variant="prompt"
          onSubmitted={dismiss}
          onDismiss={dismiss}
        />
      </div>
    </SdkBodyOverlay>
  );
}
