import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GafaClient, UserReservation } from "../client/types";
import {
  CLASS_RATING_COMMENT_MAX,
  CLASS_RATING_MAX,
  CLASS_RATING_MIN,
  classRatingIsComplete,
  clampRatingComment,
  isReservationRateable,
  isValidStarValue,
  type ClassRating,
  type ClassRatingsConfig,
} from "./classRatings";

export type ClassRatingFormProps = {
  client: GafaClient;
  reservation: UserReservation;
  config: ClassRatingsConfig;
  variant?: "card" | "prompt";
  onSubmitted?(): void;
  onDismiss?(): void;
};

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function ClassRatingForm({
  client,
  reservation,
  config,
  variant = "card",
  onSubmitted,
  onDismiss,
}: ClassRatingFormProps) {
  const queryClient = useQueryClient();
  const queryKey = ["profile", "rating", reservation.brandSlug, reservation.id];
  const ratingQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!client.getReservationRating) return null;
      return client.getReservationRating(reservation.brandSlug, reservation.id);
    },
    enabled: Boolean(client.getReservationRating) && isReservationRateable(reservation),
  });

  const [classStars, setClassStars] = useState<number | null>(null);
  const [staffStars, setStaffStars] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [doneLocal, setDoneLocal] = useState<ClassRating | null>(null);

  const saved = doneLocal ?? ratingQuery.data ?? null;
  const complete = classRatingIsComplete(saved, config);

  useEffect(() => {
    if (!saved) return;
    if (isValidStarValue(saved.classStars)) setClassStars(saved.classStars);
    if (isValidStarValue(saved.staffStars)) setStaffStars(saved.staffStars);
    if (saved.comment) setComment(saved.comment);
  }, [saved]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!client.submitReservationRating) {
        throw new Error("No pudimos guardar tu calificación.");
      }
      const nextClass = config.rateClass ? classStars : null;
      const nextStaff = config.rateCoach ? staffStars : null;
      if (config.rateClass && !isValidStarValue(nextClass)) {
        throw new Error("Elige cuántas estrellas le das a la clase.");
      }
      if (config.rateCoach && !isValidStarValue(nextStaff)) {
        throw new Error("Elige cuántas estrellas le das al coach.");
      }
      return client.submitReservationRating({
        brandSlug: reservation.brandSlug,
        reservationId: reservation.id,
        meetingId: reservation.meetingId,
        meetingName: reservation.serviceName,
        staffId: reservation.staffId,
        staffName: reservation.staffName,
        classStars: nextClass,
        staffStars: nextStaff,
        comment: clampRatingComment(comment),
      });
    },
    onSuccess: (rating) => {
      setDoneLocal(rating);
      queryClient.setQueryData(queryKey, rating);
      onSubmitted?.();
    },
  });

  if (!isReservationRateable(reservation)) return null;
  if (!client.getReservationRating && !client.submitReservationRating) return null;

  const coachLabel = reservation.staffName?.trim() || "el coach";
  const heading =
    config.rateClass && config.rateCoach
      ? "¿Qué tal estuvo?"
      : config.rateClass
        ? "¿Qué tal la clase?"
        : `¿Qué tal ${coachLabel}?`;

  return (
    <section
      className="gafa-rating"
      data-variant={variant}
      data-state={complete ? "done" : submitMutation.isError ? "error" : ratingQuery.isLoading ? "loading" : "idle"}
      aria-label="Calificar clase"
    >
      {ratingQuery.isLoading && !saved ? (
        <span className="gafa-skeleton gafa-rating__boot" />
      ) : complete ? (
        <p className="gafa-rating__thanks" role="status">
          Gracias por tu calificación
        </p>
      ) : (
        <p className="gafa-rating__title" id={`${headingId(reservation.id)}-title`}>
          {heading}
        </p>
      )}

      {config.rateClass ? (
        <StarRow
          label="La clase"
          value={classStars}
          readOnly={complete}
          onChange={setClassStars}
        />
      ) : null}
      {config.rateCoach ? (
        <StarRow
          label={coachLabel}
          value={staffStars}
          readOnly={complete}
          onChange={setStaffStars}
        />
      ) : null}

      {complete ? (
        saved?.comment ? <p className="gafa-rating__comment-out">{saved.comment}</p> : null
      ) : (
        <>
          <label className="gafa-rating__comment">
            <span>Comentario (opcional)</span>
            <textarea
              rows={variant === "prompt" ? 3 : 2}
              maxLength={CLASS_RATING_COMMENT_MAX}
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, CLASS_RATING_COMMENT_MAX))}
              placeholder="¿Algo que el estudio debería saber?"
            />
          </label>
          {submitMutation.isError ? (
            <p className="gafa-sdk-state gafa-sdk-state--error" role="alert">
              {submitMutation.error instanceof Error
                ? submitMutation.error.message
                : "No pudimos guardar tu calificación. Inténtalo de nuevo."}
            </p>
          ) : null}
          <div className="gafa-rating__actions">
            {onDismiss ? (
              <button className="gafa-sdk-button gafa-sdk-button--secondary" type="button" onClick={onDismiss}>
                Ahora no
              </button>
            ) : null}
            <button
              className="gafa-sdk-button"
              type="button"
              disabled={submitMutation.isPending || !canSubmit(config, classStars, staffStars)}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function canSubmit(config: ClassRatingsConfig, classStars: number | null, staffStars: number | null): boolean {
  if (config.rateClass && !isValidStarValue(classStars)) return false;
  if (config.rateCoach && !isValidStarValue(staffStars)) return false;
  return true;
}

function headingId(reservationId: number): string {
  return `gafa-rating-${reservationId}`;
}

function StarRow({
  label,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  value: number | null;
  readOnly: boolean;
  onChange(next: number): void;
}) {
  const groupId = useId();
  const name = useMemo(() => `stars-${groupId}`, [groupId]);
  return (
    <div className="gafa-rating-stars">
      <span className="gafa-rating-stars__label" id={`${name}-label`}>
        {label}
      </span>
      <span className="gafa-rating-stars__value">
        {isValidStarValue(value) ? `${value} / ${CLASS_RATING_MAX}` : `${CLASS_RATING_MIN}–${CLASS_RATING_MAX}`}
      </span>
      <div
        className="gafa-rating-stars__row"
        role="radiogroup"
        aria-labelledby={`${name}-label`}
        aria-readonly={readOnly || undefined}
        onKeyDown={(event) => {
          if (readOnly) return;
          const current = value ?? 0;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(Math.min(CLASS_RATING_MAX, current + 1 || 1));
          } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(Math.max(CLASS_RATING_MIN, current ? current - 1 : CLASS_RATING_MIN));
          } else if (event.key === "Home") {
            event.preventDefault();
            onChange(CLASS_RATING_MIN);
          } else if (event.key === "End") {
            event.preventDefault();
            onChange(CLASS_RATING_MAX);
          }
        }}
      >
        {STAR_VALUES.map((star) => {
          const checked = value === star;
          const filled = (value ?? 0) >= star;
          return (
            <button
              key={star}
              className="gafa-rating-star"
              type="button"
              role="radio"
              name={name}
              aria-checked={checked}
              aria-label={`${star} ${star === 1 ? "estrella" : "estrellas"} para ${label}`}
              data-filled={filled ? "true" : undefined}
              disabled={readOnly}
              onClick={() => {
                if (!readOnly) onChange(star);
              }}
            >
              <StarIcon filled={filled} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.4 14.6 9l6 .5-4.6 4 1.4 5.8L12 16.8 6.6 19.3 8 13.5 3.4 9.5 9.4 9 12 3.4Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
