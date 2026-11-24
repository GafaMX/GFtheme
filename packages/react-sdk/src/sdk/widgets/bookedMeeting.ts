import type { Brand, Meeting, UserReservation } from "../client/types";

export type SdkLang = "es" | "en" | "fr";

export function parseSdkLang(language?: string): SdkLang {
  const value = language?.trim().toLowerCase();
  if (value?.startsWith("en")) return "en";
  if (value?.startsWith("fr")) return "fr";
  return "es";
}

export const bookedCopy = {
  es: {
    locale: "es-MX",
    booked: "Reservado",
    spot: (value: string) => `Lugar ${value}`,
    spots: (count: number) => `${count} lugares`,
    cancel: "Cancelar",
    cancelSpot: (label: string) => `Cancelar ${label}`,
    manage: "Ver / cancelar",
    manageLabel: "Ver o cancelar tus lugares",
    locked: "Ya pasó el tiempo para cancelar",
    yourSpots: "Tus lugares",
    close: "Cerrar",
    cancelAll: (count: number) => `Cancelar los ${count} lugares`,
    cancelSpotTitle: (value: string) => `¿Cancelar Lugar ${value}?`,
    cancelSpotsTitle: (count: number) => `¿Cancelar tus ${count} lugares?`,
    cancelClassTitle: "¿Cancelar tu clase?",
    subjectSpots: (list: string) => `Se cancelarán los lugares ${list}`,
    subjectCount: (count: number) => `Se cancelarán tus ${count} lugares`,
    bodySingle: "Se libera tu lugar y te regresamos la clase a tu paquete, según las reglas del estudio.",
    bodyMultiple: "Te regresamos las clases a tu paquete, según las reglas del estudio.",
    bodyLateSingle: "Se libera tu lugar sin regresar la clase a tu paquete.",
    bodyLateMultiple: "Se liberan tus lugares. Las clases de las reservas fuera del plazo de devolución no regresan a tu paquete.",
    confirm: "Sí, cancelar",
    keep: "No, dejarla",
    busy: "Un momento…",
    successSingle: "Cancelamos tu reserva.",
    successMultiple: "Cancelamos tus reservas.",
    errorLocked: "Ya no se puede cancelar esta reserva.",
    errorGeneric: "No pudimos cancelar. Inténtalo de nuevo.",
    errorSpot: (value: string) => `Lugar ${value}`,
    errorSpots: (list: string) => `No pudimos cancelar ${list}.`,
    yourBooking: "Tu reserva",
    booking: (index: number) => `Reserva ${index}`,
    and: "y",
  },
  en: {
    locale: "en-US",
    booked: "Booked",
    spot: (value: string) => `Spot ${value}`,
    spots: (count: number) => `${count} spots`,
    cancel: "Cancel",
    cancelSpot: (label: string) => `Cancel ${label}`,
    manage: "View / cancel",
    manageLabel: "View or cancel your spots",
    locked: "The cancellation window has closed",
    yourSpots: "Your spots",
    close: "Close",
    cancelAll: (count: number) => `Cancel all ${count} spots`,
    cancelSpotTitle: (value: string) => `Cancel Spot ${value}?`,
    cancelSpotsTitle: (count: number) => `Cancel your ${count} spots?`,
    cancelClassTitle: "Cancel your class?",
    subjectSpots: (list: string) => `Spots ${list} will be cancelled`,
    subjectCount: (count: number) => `Your ${count} spots will be cancelled`,
    bodySingle: "Your spot is released and the class goes back to your package, per the studio's rules.",
    bodyMultiple: "The classes go back to your package, per the studio's rules.",
    bodyLateSingle: "Your spot is released without returning the class to your package.",
    bodyLateMultiple: "Your spots are released. Classes booked past the refund deadline do not go back to your package.",
    confirm: "Yes, cancel",
    keep: "No, keep it",
    busy: "One moment…",
    successSingle: "Your booking was cancelled.",
    successMultiple: "Your bookings were cancelled.",
    errorLocked: "This booking can no longer be cancelled.",
    errorGeneric: "We couldn't cancel. Please try again.",
    errorSpot: (value: string) => `Spot ${value}`,
    errorSpots: (list: string) => `We couldn't cancel ${list}.`,
    yourBooking: "Your booking",
    booking: (index: number) => `Booking ${index}`,
    and: "and",
  },
  fr: {
    locale: "fr-FR",
    booked: "Réservé",
    spot: (value: string) => `Place ${value}`,
    spots: (count: number) => `${count} places`,
    cancel: "Annuler",
    cancelSpot: (label: string) => `Annuler ${label}`,
    manage: "Voir / annuler",
    manageLabel: "Voir ou annuler vos places",
    locked: "Le délai d'annulation est dépassé",
    yourSpots: "Vos places",
    close: "Fermer",
    cancelAll: (count: number) => `Annuler les ${count} places`,
    cancelSpotTitle: (value: string) => `Annuler la place ${value} ?`,
    cancelSpotsTitle: (count: number) => `Annuler vos ${count} places ?`,
    cancelClassTitle: "Annuler votre cours ?",
    subjectSpots: (list: string) => `Les places ${list} seront annulées`,
    subjectCount: (count: number) => `Vos ${count} places seront annulées`,
    bodySingle: "Votre place est libérée et le cours est recrédité sur votre forfait, selon les règles du studio.",
    bodyMultiple: "Les cours sont recrédités sur votre forfait, selon les règles du studio.",
    bodyLateSingle: "Votre place est libérée sans recréditer le cours sur votre forfait.",
    bodyLateMultiple: "Vos places sont libérées. Les cours annulés hors délai de recrédit ne sont pas recrédités sur votre forfait.",
    confirm: "Oui, annuler",
    keep: "Non, la garder",
    busy: "Un instant…",
    successSingle: "Votre réservation a été annulée.",
    successMultiple: "Vos réservations ont été annulées.",
    errorLocked: "Cette réservation ne peut plus être annulée.",
    errorGeneric: "Nous n'avons pas pu annuler. Réessayez.",
    errorSpot: (value: string) => `la place ${value}`,
    errorSpots: (list: string) => `Nous n'avons pas pu annuler ${list}.`,
    yourBooking: "Votre réservation",
    booking: (index: number) => `Réservation ${index}`,
    and: "et",
  },
};

export type BookedSpot = Pick<UserReservation, "id" | "brandSlug" | "seatLabel"> & {
  canCancel: boolean;
  withoutCredit: boolean;
};

export type BookedMeeting = Meeting & { bookedSpots?: BookedSpot[] };

const serverDateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Mexico_City",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function deadlinePassed(deadline: string | undefined, now: number): boolean {
  if (!deadline) return false;
  const value = deadline.trim().replace(" ", "T");
  // Laravel's bare timestamps are stored in the API's zone, not the venue's.
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(value)) {
    return serverDateTime.format(now).replace(" ", "T") > (value.length === 16 ? `${value}:00` : value);
  }
  return now > Date.parse(value);
}

type CancellationPolicy = Pick<UserReservation, "cancelled" | "canCancel" | "cancelableUntil" | "refundableUntil" | "cancellationWithoutCredit">;

export function reservationCanCancel(reservation: CancellationPolicy, now = Date.now()): boolean {
  return reservation.canCancel === true && !reservation.cancelled && !deadlinePassed(reservation.cancelableUntil, now);
}

export function seatLabelOf(reservation: Pick<UserReservation, "seatLabel">): string | undefined {
  return reservation.seatLabel?.trim().replace(/^(?:lugar|spot|place)\s+/i, "") || undefined;
}

export function reservationsForMeeting(reservations: UserReservation[], meeting: Meeting, now = Date.now()): BookedSpot[] {
  const start = Date.parse(meeting.startsAt || meeting.start || meeting.startTime || "");
  if (meeting.passed || start <= now) return [];
  const name = (meeting.service?.name ?? meeting.serviceName ?? meeting.name).trim();
  const brand = meeting.brandSlug ?? meeting.location?.brandSlug ?? meeting.location?.brand?.slug;
  return reservations.filter((reservation) => {
    if (reservation.cancelled || reservation.isWaitlist || (brand && reservation.brandSlug !== brand)) return false;
    if (reservation.meetingId != null) return Number(reservation.meetingId) === Number(meeting.id);
    return Boolean(brand && name && name === reservation.serviceName.trim() && start === Date.parse(reservation.startsAt) &&
      (!reservation.locationName || !meeting.location?.name || reservation.locationName === meeting.location.name));
  }).map((reservation) => ({
    id: reservation.id,
    brandSlug: reservation.brandSlug,
    seatLabel: seatLabelOf(reservation),
    canCancel: reservationCanCancel(reservation, now),
    withoutCredit: reservation.cancellationWithoutCredit === true || deadlinePassed(reservation.refundableUntil, now),
  })).sort((a, b) => (a.seatLabel ?? "").localeCompare(b.seatLabel ?? "", "es", { numeric: true }) || a.id - b.id);
}

export function formatLugarLabel(seatLabel?: string, lang: SdkLang = "es"): string | null {
  const label = seatLabelOf({ seatLabel });
  return label ? bookedCopy[lang].spot(label) : null;
}

export function spotRowLabel(spot: BookedSpot, index: number, total: number, lang: SdkLang = "es"): string {
  return formatLugarLabel(spot.seatLabel, lang) ?? (total <= 1 ? bookedCopy[lang].yourBooking : bookedCopy[lang].booking(index + 1));
}

export function bookedPillText(spots: BookedSpot[], lang: SdkLang = "es"): string {
  const copy = bookedCopy[lang];
  if (spots.length === 0) return copy.booked;
  if (spots.length === 1) {
    const label = formatLugarLabel(spots[0].seatLabel, lang);
    return label ? `${copy.booked} · ${label}` : copy.booked;
  }
  const labels = spots.map(seatLabelOf);
  return `${copy.booked} · ${copy.spots(spots.length)}${labels.every(Boolean) ? ` (${labels.join(", ")})` : ""}`;
}

export function bookedCardAction(spots: BookedSpot[]) {
  if (spots.length > 1) return "manage";
  return spots[0]?.canCancel ? "cancel" : "locked";
}

export function bookedActionLabel(action: ReturnType<typeof bookedCardAction>, lang: SdkLang = "es"): string {
  return action === "manage" ? bookedCopy[lang].manage : bookedCopy[lang].cancel;
}

export function cancelLockedHint(lang: SdkLang = "es"): string {
  return bookedCopy[lang].locked;
}

export function reservationBrandSlugs(brands: Brand[], selectedBrandSlug?: string, pinnedBrandId?: number): string[] {
  return [...new Set(brands.filter((brand) => selectedBrandSlug
    ? brand.slug === selectedBrandSlug
    : pinnedBrandId == null || Number(brand.id) === Number(pinnedBrandId))
    .map((brand) => brand.slug).filter(Boolean))].sort();
}

export function mergeReservationsById(batches: UserReservation[][]): UserReservation[] {
  const reservations = new Map<number, UserReservation>();
  for (const batch of batches) {
    for (const reservation of batch) {
      if (reservation.cancelled || reservation.isWaitlist) continue;
      if (!reservations.has(reservation.id)) reservations.set(reservation.id, reservation);
    }
  }
  return [...reservations.values()];
}

export function cancellableSpots(spots: BookedSpot[]): BookedSpot[] {
  return spots.filter((spot) => spot.canCancel);
}

export function overlayBookedMeetings<T extends Meeting>(meetings: T[], reservations?: UserReservation[], now = Date.now()): (T & BookedMeeting)[] {
  if (!reservations?.length) return meetings;
  const matches = meetings.map((meeting) => reservationsForMeeting(reservations, meeting, now));
  const matchCounts = new Map<number, number>();
  for (const spots of matches) {
    for (const spot of spots) matchCounts.set(spot.id, (matchCounts.get(spot.id) ?? 0) + 1);
  }
  return meetings.map((meeting, index) => {
    // A fallback match must identify one class when identical services overlap.
    const spots = matches[index].filter((spot) => matchCounts.get(spot.id) === 1);
    return spots.length ? { ...meeting, isReserved: true, bookedSpots: spots } : meeting;
  });
}

export function joinBookedLabels(labels: string[], lang: SdkLang): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} ${bookedCopy[lang].and} ${labels[labels.length - 1]}`;
}

export function confirmCancelTitle(spots: BookedSpot[], lang: SdkLang = "es"): string {
  const copy = bookedCopy[lang];
  if (spots.length > 1) return copy.cancelSpotsTitle(spots.length);
  const label = spots[0] && seatLabelOf(spots[0]);
  return label ? copy.cancelSpotTitle(label) : copy.cancelClassTitle;
}

export function confirmCancelSubject(spots: BookedSpot[], lang: SdkLang = "es"): string {
  if (spots.length <= 1) return bookedPillText(spots, lang);
  const labels = spots.map(seatLabelOf).filter((label): label is string => Boolean(label));
  const copy = bookedCopy[lang];
  return labels.length === spots.length ? copy.subjectSpots(joinBookedLabels(labels, lang)) : copy.subjectCount(spots.length);
}

export function confirmCancelBody(spots: BookedSpot[], lang: SdkLang = "es"): string {
  const copy = bookedCopy[lang];
  if (spots.some((spot) => spot.withoutCredit)) return spots.length > 1 ? copy.bodyLateMultiple : copy.bodyLateSingle;
  return spots.length > 1 ? copy.bodyMultiple : copy.bodySingle;
}

export function cancelAllLabel(count: number, lang: SdkLang = "es"): string {
  return bookedCopy[lang].cancelAll(count);
}
