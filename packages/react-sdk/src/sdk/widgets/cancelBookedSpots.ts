import { availabilityFromCapacity } from "../client/meetingAvailability";
import { bookedCopy, joinBookedLabels, seatLabelOf, spotRowLabel, type BookedMeeting, type BookedSpot, type SdkLang } from "./bookedMeeting";

export class CancelSpotsPartialError extends Error {
  constructor(
    readonly cancelled: BookedSpot[],
    readonly failed: { spot: BookedSpot; error: unknown }[],
  ) {
    super("Cancellation failed");
    this.name = "CancelSpotsPartialError";
  }
}

export async function cancelSpotsSequentially(
  cancelOne: (brandSlug: string, id: number) => Promise<unknown>,
  spots: BookedSpot[],
): Promise<BookedSpot[]> {
  const cancelled: BookedSpot[] = [];
  const failed: CancelSpotsPartialError["failed"] = [];
  for (const spot of spots) {
    try {
      await cancelOne(spot.brandSlug, spot.id);
      cancelled.push(spot);
    } catch (error) {
      failed.push({ spot, error });
    }
  }
  if (failed.length) throw new CancelSpotsPartialError(cancelled, failed);
  return cancelled;
}

export function dropReservationsById<T extends { id: number }>(list: T[] | undefined, ids: ReadonlySet<number>): T[] | undefined {
  return list?.filter((item) => !ids.has(item.id));
}

export function succeededCancelIds(error: unknown): Set<number> {
  return new Set(error instanceof CancelSpotsPartialError ? error.cancelled.map((spot) => spot.id) : []);
}

export function applyOptimisticCancelToMeetings<T extends BookedMeeting>(
  meetings: T[] | undefined,
  ids: ReadonlySet<number>,
): T[] | undefined {
  return meetings?.map((meeting) => {
    if (!meeting.bookedSpots?.length) return meeting;
    const remaining = meeting.bookedSpots.filter((spot) => !ids.has(spot.id));
    const released = meeting.bookedSpots.length - remaining.length;
    if (!released) return meeting;
    const available = meeting.available == null ? undefined : meeting.available + released;
    const isReserved = remaining.length > 0;
    return {
      ...meeting,
      available,
      isReserved,
      bookedSpots: remaining,
      availability: availabilityFromCapacity({ available, is_reserved: isReserved, waitlistAvailable: meeting.waitlistAvailable }),
    };
  });
}

function isDeadlineError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("codigo" in error && error.codigo === "cancelacion_fuera_de_plazo") return true;
  return error instanceof Error &&
    /fuera del horario de cancelaci[oó]n|reservations\.errors\.canNotCancell/i.test(error.message);
}

export function errorDeCancelacion(error: unknown, lang: SdkLang = "es"): string {
  const cause = error instanceof CancelSpotsPartialError ? error.failed[0]?.error : error;
  return isDeadlineError(cause) ? bookedCopy[lang].errorLocked : bookedCopy[lang].errorGeneric;
}

export function errorCancelacionFallida(error: unknown, lang: SdkLang = "es"): string {
  if (!(error instanceof CancelSpotsPartialError) || !error.cancelled.length) return errorDeCancelacion(error, lang);
  const labels = error.failed.map(({ spot }, index) => {
    const seat = seatLabelOf(spot);
    return seat ? bookedCopy[lang].errorSpot(seat) : spotRowLabel(spot, index, error.failed.length, lang);
  });
  const message = bookedCopy[lang].errorSpots(joinBookedLabels(labels, lang));
  return error.failed.some(({ error }) => isDeadlineError(error)) ? `${message} ${bookedCopy[lang].errorLocked}` : message;
}
