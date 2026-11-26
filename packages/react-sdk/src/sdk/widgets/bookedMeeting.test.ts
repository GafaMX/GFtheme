import { describe, expect, it } from "vitest";
import type { Meeting, UserReservation } from "../client/types";
import {
  bookedCardAction, bookedPillText, cancelAllLabel, cancelLockedHint, confirmCancelBody,
  confirmCancelSubject, confirmCancelTitle, mergeReservationsById, overlayBookedMeetings,
  parseSdkLang, reservationBrandSlugs, reservationCanCancel, reservationsForMeeting, spotRowLabel,
} from "./bookedMeeting";

const now = Date.parse("2026-11-24T18:00:00Z");
const startsAt = "2026-11-25T01:30:00Z";
const meeting: Meeting = { id: 20, startsAt, name: "Ride", brandSlug: "fitspin-cancun", available: 2 };
const base: UserReservation = {
  id: 91, brandSlug: "fitspin-cancun", startsAt, serviceName: "Ride", isWaitlist: false,
  isOverbooking: false, canCancel: true, seatLabel: "Lugar 4",
};

describe("reservas del calendario", () => {
  it("usa meetingId primero y compara inicio, servicio y marca cuando falta", () => {
    const reservations = [
      base,
      { ...base, id: 92, meetingId: 20, startsAt: "", seatLabel: "7" },
      { ...base, id: 93, meetingId: 21 },
      { ...base, id: 94, startsAt: "2026-11-24T19:30:00-06:00", seatLabel: "10" },
      { ...base, id: 95, brandSlug: "fitspin" },
      { ...base, id: 96, serviceName: "Otro" },
      { ...base, id: 97, isWaitlist: true },
      { ...base, id: 98, cancelled: true },
    ];
    const spots = reservationsForMeeting(reservations, meeting, now);
    expect(spots.map(({ id, seatLabel }) => [id, seatLabel])).toEqual([[91, "4"], [92, "7"], [94, "10"]]);
    expect(overlayBookedMeetings([meeting], reservations, now)[0]).toMatchObject({ isReserved: true, bookedSpots: spots });
    expect(reservationsForMeeting(reservations, { ...meeting, passed: true }, now)).toEqual([]);
    expect(reservationsForMeeting(reservations, meeting, Date.parse(startsAt))).toEqual([]);
  });

  it("omite la acción si una reserva sin id coincide con dos clases simultáneas", () => {
    const matches = overlayBookedMeetings([meeting, { ...meeting, id: 21 }], [base], now);
    expect(matches.map((item) => item.bookedSpots)).toEqual([undefined, undefined]);
  });

  it("incluye todas las marcas en Todos y deduplica ids de reservas activas", () => {
    const brands = [{ id: 1, slug: "fitspin", name: "Fitspin" }, { id: 2, slug: "fitspin-cancun", name: "Cancún" }];
    expect(reservationBrandSlugs(brands)).toEqual(["fitspin", "fitspin-cancun"]);
    expect(reservationBrandSlugs(brands, undefined, 2)).toEqual(["fitspin-cancun"]);
    expect(reservationBrandSlugs(brands, "fitspin")).toEqual(["fitspin"]);
    expect(mergeReservationsById([[base, { ...base, id: 93, isWaitlist: true }], [base, { ...base, id: 94, cancelled: true }]])).toEqual([base]);
  });

  it("respeta canCancel y ambos plazos de gafa.fit", () => {
    expect(reservationCanCancel({ canCancel: false }, now)).toBe(false);
    expect(reservationCanCancel({ canCancel: true, cancelableUntil: "2026-11-24 11:59:59" }, now)).toBe(false);
    expect(reservationCanCancel({ canCancel: true, cancelableUntil: "2026-11-24T18:00:00Z" }, now)).toBe(true);
    const [late] = reservationsForMeeting([{ ...base, refundableUntil: "2026-11-24T17:00:00Z", cancelableUntil: startsAt }], meeting, now);
    expect(late).toMatchObject({ canCancel: true, withoutCredit: true });
    expect(confirmCancelBody([late])).toContain("sin regresar");
    const locked = reservationsForMeeting([{ ...base, canCancel: false }], meeting, now);
    expect(bookedCardAction(locked)).toBe("locked");
  });

  it.each([
    ["2026-11-24 12:30:00", false],
    ["2026-11-24T13:00:00", true],
    ["2026-11-24T12:59:59.999", false],
    ["2026-11-24T12:30:00-06:00", true],
    ["2026-11-24 12:30:00-0500", false],
    ["2026-11-24T18:30:00Z", true],
  ])("evalúa %s respetando la zona de Cancún o el offset explícito", (deadline, open) => {
    const reservation = { ...base, timezone: "America/Cancun", cancelableUntil: deadline };
    expect(reservationCanCancel(reservation, now)).toBe(open);
    const [spot] = reservationsForMeeting([{
      ...reservation,
      cancelableUntil: startsAt,
      refundableUntil: deadline,
    }], meeting, now);
    expect(spot).toMatchObject({ canCancel: true, withoutCredit: !open });
  });

  it("usa la zona de CDMX cuando no hay zona de la reserva ni de la marca", () => {
    expect(reservationCanCancel({ canCancel: true, cancelableUntil: "2026-11-24 12:30:00" }, now)).toBe(true);
  });

  it("resuelve el cambio de horario de verano en la zona de la reserva", () => {
    const reservation = { canCancel: true, timezone: "America/New_York", cancelableUntil: "2026-11-01 01:30:00" };
    expect(reservationCanCancel(reservation, Date.parse("2026-11-01T05:30:00Z"))).toBe(true);
    expect(reservationCanCancel(reservation, Date.parse("2026-11-01T06:00:00Z"))).toBe(false);
  });

  it.each([
    ["es-MX", "Reservado · Lugar 4", "Reservado · 2 lugares (4, 7)", "¿Cancelar el lugar 4?", "Se cancelarán los lugares 4 y 7", "Cancelar los 2 lugares"],
    ["en-CA", "Booked · Spot 4", "Booked · 2 spots (4, 7)", "Cancel Spot 4?", "Spots 4 and 7 will be cancelled", "Cancel all 2 spots"],
    ["FR-CA", "Réservé · Place 4", "Réservé · 2 places (4, 7)", "Annuler la place 4\u202f?", "Les places 4 et 7 seront annulées", "Annuler les 2 places"],
  ])("localiza las reservas en %s", (language, single, multi, title, subject, all) => {
    const lang = parseSdkLang(language);
    const spots = reservationsForMeeting([base, { ...base, id: 92, seatLabel: "7" }], meeting, now);
    expect(bookedPillText(spots.slice(0, 1), lang)).toBe(single);
    expect(bookedPillText(spots, lang)).toBe(multi);
    expect(confirmCancelTitle(spots.slice(0, 1), lang)).toBe(title);
    expect(confirmCancelSubject(spots, lang)).toBe(subject);
    expect(cancelAllLabel(2, lang)).toBe(all);
  });

  it("usa un espacio estrecho inseparable antes del signo de interrogación en francés", () => {
    const spots = reservationsForMeeting([base, { ...base, id: 92, seatLabel: "7" }], meeting, now);
    expect(confirmCancelTitle(spots, "fr")).toBe("Annuler vos 2 places\u202f?");
    expect(confirmCancelTitle([{ ...spots[0], seatLabel: undefined }], "fr")).toBe("Annuler votre cours\u202f?");
  });

  it("maneja clases sin mapa, reservas incompletas y español como idioma de respaldo", () => {
    const spots = reservationsForMeeting([{ ...base, seatLabel: undefined }, { ...base, id: 92, seatLabel: undefined }], meeting, now);
    expect(bookedPillText(spots)).toBe("Reservado · 2 lugares");
    expect(spotRowLabel(spots[1], 1, 2)).toBe("Reserva 2");
    expect(spotRowLabel(spots[0], 0, 1, "fr")).toBe("Votre réservation");
    expect(confirmCancelTitle(spots.slice(0, 1))).toBe("¿Cancelar tu clase?");
    expect(confirmCancelSubject(spots)).toBe("Se cancelarán tus 2 lugares");
    expect(cancelLockedHint(parseSdkLang("pt"))).toBe("Ya pasó el tiempo para cancelar");
  });
});
