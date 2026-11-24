import { useQuery } from "@tanstack/react-query";
import type { GafaClient, UserReservation } from "../client/types";
import { isReservationRateable } from "./classRatings";

export function reservationRatingKey(reservation: Pick<UserReservation, "brandSlug" | "id">) {
  return ["profile", "rating", reservation.brandSlug, reservation.id] as const;
}

/** Calificación guardada de una reserva (null si todavía no hay). Cache compartido tarjeta ↔ popup. */
export function useReservationRating(client: GafaClient, reservation: UserReservation) {
  return useQuery({
    queryKey: reservationRatingKey(reservation),
    queryFn: async () => {
      if (!client.getReservationRating) return null;
      return client.getReservationRating(reservation.brandSlug, reservation.id);
    },
    enabled: Boolean(client.getReservationRating) && isReservationRateable(reservation),
  });
}
