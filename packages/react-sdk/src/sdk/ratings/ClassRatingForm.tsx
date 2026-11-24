import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GafaClient, UserReservation } from "../client/types";
import {
  CLASS_RATING_COMMENT_MAX,
  CLASS_RATING_MAX,
  CLASS_RATING_MIN,
  clampRatingComment,
  isValidStarValue,
  type ClassRating,
  type ClassRatingsConfig,
} from "./classRatings";
import { reservationRatingKey } from "./useReservationRating";

export type ClassRatingFormProps = {
  client: GafaClient;
  reservation: UserReservation;
  config: ClassRatingsConfig;
  onSubmitted?(rating: ClassRating): void;
  /** Botón “Cancelar” del popup. */
  onCancel?(): void;
  /** Para que el popup no se cierre a media petición. */
  onPendingChange?(pending: boolean): void;
};

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

/**
 * Cuerpo del popup de calificar: estrellas de clase y coach, comentario
 * opcional, Enviar / Cancelar y el error. Ya no vive abierto dentro de la
 * tarjeta de la clase: lo monta `ClassRatingDialog`.
 */
export function ClassRatingForm({
  client,
  reservation,
  config,
  onSubmitted,
  onCancel,
  onPendingChange,
}: ClassRatingFormProps) {
  const queryClient = useQueryClient();
  const [classStars, setClassStars] = useState<number | null>(null);
  const [staffStars, setStaffStars] = useState<number | null>(null);
  const [comment, setComment] = useState("");

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
      queryClient.setQueryData(reservationRatingKey(reservation), rating);
      onSubmitted?.(rating);
    },
  });

  useEffect(() => {
    onPendingChange?.(submitMutation.isPending);
  }, [onPendingChange, submitMutation.isPending]);

  const coachLabel = reservation.staffName?.trim() || "el coach";
  const heading =
    config.rateClass && config.rateCoach
      ? "¿Qué tal estuvo?"
      : config.rateClass
        ? "¿Qué tal la clase?"
        : `¿Qué tal ${coachLabel}?`;

  return (
    <div className="gafa-rating" data-state={submitMutation.isError ? "error" : "idle"}>
      <p className="gafa-rating__title">{heading}</p>

      {config.rateClass ? <StarRow label="La clase" value={classStars} onChange={setClassStars} /> : null}
      {config.rateCoach ? <StarRow label={coachLabel} value={staffStars} onChange={setStaffStars} /> : null}

      <label className="gafa-rating__comment">
        <span>Comentario (opcional)</span>
        <textarea
          rows={3}
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
        {onCancel ? (
          <button
            className="gafa-sdk-button gafa-sdk-button--secondary"
            type="button"
            disabled={submitMutation.isPending}
            onClick={onCancel}
          >
            Cancelar
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
    </div>
  );
}

function canSubmit(config: ClassRatingsConfig, classStars: number | null, staffStars: number | null): boolean {
  if (config.rateClass && !isValidStarValue(classStars)) return false;
  if (config.rateCoach && !isValidStarValue(staffStars)) return false;
  return true;
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
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
        onKeyDown={(event) => {
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
              onClick={() => onChange(star)}
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
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
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
