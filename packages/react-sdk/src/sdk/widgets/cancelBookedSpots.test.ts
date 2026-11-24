import { expect, it, vi } from "vitest";
import type { BookedMeeting, BookedSpot } from "./bookedMeeting";
import {
  applyOptimisticCancelToMeetings, CancelSpotsPartialError, cancelSpotsSequentially,
  dropReservationsById, errorCancelacionFallida, errorDeCancelacion, succeededCancelIds,
} from "./cancelBookedSpots";

const four: BookedSpot = { id: 4, seatLabel: "4", brandSlug: "fitspin", canCancel: true, withoutCredit: false };
const seven: BookedSpot = { ...four, id: 7, seatLabel: "7" };

it("espera cada POST y reporta qué lugares se cancelaron ante un fallo parcial", async () => {
  let finishFirst!: () => void;
  const cancel = vi.fn<(slug: string, id: number) => Promise<void>>()
    .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
    .mockRejectedValueOnce(new Error("network"));
  const result = cancelSpotsSequentially(cancel, [four, seven]).catch((error: unknown) => error);
  expect(cancel.mock.calls).toEqual([["fitspin", 4]]);
  finishFirst();
  const error = await result;
  expect(error).toBeInstanceOf(CancelSpotsPartialError);
  expect(cancel.mock.calls).toEqual([["fitspin", 4], ["fitspin", 7]]);
  expect(succeededCancelIds(error)).toEqual(new Set([4]));
  expect(errorCancelacionFallida(error)).toBe("No pudimos cancelar Lugar 7.");
  expect(errorCancelacionFallida(error, "en")).toBe("We couldn't cancel Spot 7.");
  expect(errorCancelacionFallida(error, "fr")).toBe("Nous n'avons pas pu annuler la place 7.");
  expect(dropReservationsById([four, seven], succeededCancelIds(error))).toEqual([seven]);
});

it("repone cupos solo para los lugares retirados y conserva el estado de reserva restante", () => {
  const meeting: BookedMeeting = { id: 1, startsAt: "", name: "Ride", available: 0, isReserved: true, bookedSpots: [four, seven] };
  expect(applyOptimisticCancelToMeetings([meeting], new Set([4]))?.[0]).toMatchObject({ available: 1, isReserved: true, bookedSpots: [seven] });
  expect(applyOptimisticCancelToMeetings([meeting], new Set([4, 7]))?.[0]).toMatchObject({ available: 2, isReserved: false, bookedSpots: [] });
  expect(applyOptimisticCancelToMeetings([meeting], new Set([9]))?.[0]).toBe(meeting);
});

it("localiza el error real de gafa.fit y distingue otros fallos", () => {
  expect(errorDeCancelacion(new Error("Lo sentimos, estás fuera del horario de cancelación."))).toBe("Ya no se puede cancelar esta reserva.");
  expect(errorDeCancelacion({ codigo: "cancelacion_fuera_de_plazo" }, "fr")).toBe("Cette réservation ne peut plus être annulée.");
  expect(errorDeCancelacion(new Error("403"), "en")).toBe("We couldn't cancel. Please try again.");
});
