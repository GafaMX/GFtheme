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
    cancelSpot: (label: string) =>
      label.startsWith("Lugar ") ? `Cancelar el lugar ${label.slice("Lugar ".length)}` : `Cancelar ${label}`,
    manage: "Ver / cancelar",
    manageLabel: "Ver / cancelar tus lugares",
    locked: "Ya pasó el tiempo para cancelar",
    yourSpots: "Tus lugares",
    close: "Cerrar",
    cancelAll: (count: number) => `Cancelar los ${count} lugares`,
    cancelAvailable: (count: number) => count === 1 ? "Cancelar el lugar disponible" : `Cancelar los ${count} lugares disponibles`,
    expiredSpots: (list: string) => `El plazo de cancelación ya venció para ${list}.`,
    cancelSpotTitle: (value: string) => `¿Cancelar el lugar ${value}?`,
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
    errorSpot: (value: string) => `el lugar ${value}`,
    errorSpots: (list: string) => `No pudimos cancelar ${list}.`,
    yourBooking: "Tu reserva",
    booking: (index: number) => `Reserva ${index}`,
    and: "y",
    location: "Ubicación",
    enrollment: "Inscripción",
  },
  en: {
    locale: "en-US",
    booked: "Booked",
    spot: (value: string) => `Spot ${value}`,
    spots: (count: number) => `${count} spots`,
    cancel: "Cancel",
    cancelSpot: (label: string) => `Cancel ${label}`,
    manage: "View / cancel",
    manageLabel: "View / cancel your spots",
    locked: "The cancellation window has closed",
    yourSpots: "Your spots",
    close: "Close",
    cancelAll: (count: number) => `Cancel all ${count} spots`,
    cancelAvailable: (count: number) => count === 1 ? "Cancel the available spot" : `Cancel all ${count} available spots`,
    expiredSpots: (list: string) => `The cancellation window has closed for ${list}.`,
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
    location: "Location",
    enrollment: "Enrollment",
  },
  fr: {
    locale: "fr-FR",
    booked: "Réservé",
    spot: (value: string) => `Place ${value}`,
    spots: (count: number) => `${count} places`,
    cancel: "Annuler",
    cancelSpot: (label: string) =>
      label.startsWith("Place ") ? `Annuler la place ${label.slice("Place ".length)}` : `Annuler ${label}`,
    manage: "Voir / annuler",
    manageLabel: "Voir / annuler vos places",
    locked: "Le délai d’annulation est dépassé",
    yourSpots: "Vos places",
    close: "Fermer",
    cancelAll: (count: number) => `Annuler les ${count} places`,
    cancelAvailable: (count: number) => count === 1 ? "Annuler la place disponible" : `Annuler les ${count} places disponibles`,
    expiredSpots: (list: string) => `Le délai d’annulation est dépassé pour ${list}.`,
    cancelSpotTitle: (value: string) => `Annuler la place ${value}\u202f?`,
    cancelSpotsTitle: (count: number) => `Annuler vos ${count} places\u202f?`,
    cancelClassTitle: "Annuler votre cours\u202f?",
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
    errorGeneric: "Nous n’avons pas pu annuler. Réessayez.",
    errorSpot: (value: string) => `la place ${value}`,
    errorSpots: (list: string) => `Nous n’avons pas pu annuler ${list}.`,
    yourBooking: "Votre réservation",
    booking: (index: number) => `Réservation ${index}`,
    and: "et",
    location: "Lieu",
    enrollment: "Inscription",
  },
};

export type BookedSpot = Pick<UserReservation, "id" | "brandSlug" | "seatLabel"> & {
  canCancel: boolean;
  withoutCredit: boolean;
};

export type BookedMeeting = Meeting & { bookedSpots?: BookedSpot[] };

const deadlineFormatters = new Map<string, Intl.DateTimeFormat>();
const defaultDeadlineZone = "America/Mexico_City";
const dayInMilliseconds = 86_400_000;

function deadlineFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = deadlineFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  deadlineFormatters.set(timeZone, formatter);
  return formatter;
}

function deadlinePassed(deadline: string | undefined, now: number, timeZone?: string): boolean {
  const value = deadline?.trim().replace(" ", "T");
  if (!value) return false;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return now > Date.parse(value);

  const local = value.length === 10 ? `${value}T00:00:00` : value;
  const wallTime = Date.parse(`${local}Z`);
  if (!Number.isFinite(wallTime)) return false;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = deadlineFormatter(timeZone || defaultDeadlineZone);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    formatter = deadlineFormatter(defaultDeadlineZone);
  }

  function offsetAt(instant: number): number {
    const seconds = Math.floor(instant / 1000) * 1000;
    return Date.parse(`${formatter.format(seconds).replace(" ", "T")}Z`) - seconds;
  }

  // Resolve the offset at the deadline, including dates near a DST change.
  // Use the first occurrence of a repeated hour and move skipped times forward.
  const before = wallTime - offsetAt(wallTime - dayInMilliseconds);
  const after = wallTime - offsetAt(wallTime + dayInMilliseconds);
  const cutoff = before === after || before + offsetAt(before) === wallTime ? before
    : after + offsetAt(after) === wallTime ? after : before;
  return now > cutoff;
}

type CancellationPolicy = Pick<UserReservation, "cancelled" | "canCancel" | "cancelableUntil" | "timezone">;

export function reservationCanCancel(reservation: CancellationPolicy, now = Date.now()): boolean {
  return reservation.canCancel === true && !reservation.cancelled &&
    !deadlinePassed(reservation.cancelableUntil, now, reservation.timezone);
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
    withoutCredit: reservation.cancellationWithoutCredit === true || deadlinePassed(reservation.refundableUntil, now, reservation.timezone),
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

export function expiredSpotsMessage(spots: BookedSpot[], lang: SdkLang): string | undefined {
  const labels = spots.flatMap((spot, index) => {
    if (spot.canCancel) return [];
    const seat = seatLabelOf(spot);
    return [seat ? bookedCopy[lang].errorSpot(seat) : spotRowLabel(spot, index, spots.length, lang)];
  });
  return labels.length ? bookedCopy[lang].expiredSpots(joinBookedLabels(labels, lang)) : undefined;
}
