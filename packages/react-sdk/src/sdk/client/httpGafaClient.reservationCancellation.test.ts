import { afterEach, expect, it, vi } from "vitest";
import { createHttpGafaClient } from "./httpGafaClient";
import { clearStoredToken, writeStoredToken } from "./tokenStorage";

afterEach(() => {
  clearStoredToken();
  vi.unstubAllGlobals();
});

it("normaliza los ids, lugares y plazos de reservation-future y usa su POST de cancelación", async () => {
  writeStoredToken("fixture");
  const fetchMock = vi.fn(async (_input: string, options?: RequestInit) => {
    if (options?.method === "POST") return Response.json({});
    return Response.json([{ reservations: [
      {
        id: 1, meetings_id: "7", object: { position_text: "4" }, canBeCancelled: true,
        meeting_start: "2026-11-25T01:30:00Z", service: { name: "Ride" },
        cancelation_dead_line: "2026-11-24T23:00:00Z",
      },
      {
        id: 2, meetings: { id: 8 }, meeting_position: 7,
        meeting_start: "2026-11-25T01:30:00Z", canBeCancelledWithoutCredit: true,
        cancelation_dead_line: "2026-11-24 10:00:00",
        cancelation_without_credit_dead_line: "2026-11-24 20:00:00",
      },
      { id: 3, meeting_start: "2026-11-25T01:30:00Z", canBeCancelled: false },
    ], waitlists: [{ id: 4 }] }]);
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = createHttpGafaClient({ apiBaseUrl: "https://example.test", companyId: 80 });
  const rows = await client.listUserReservations("fitspin", "future");
  expect(rows.find(({ id }) => id === 1)).toMatchObject({ meetingId: 7, seatLabel: "4", canCancel: true, cancelableUntil: "2026-11-24T23:00:00Z" });
  expect(rows.find(({ id }) => id === 2)).toMatchObject({
    meetingId: 8, seatLabel: "7", canCancel: true, cancellationWithoutCredit: true,
    refundableUntil: "2026-11-24 10:00:00", cancelableUntil: "2026-11-24 20:00:00",
  });
  expect(rows.find(({ id }) => id === 3)).toMatchObject({ meetingId: undefined, canCancel: false });
  expect(rows.find(({ id }) => id === 4)).toMatchObject({ isWaitlist: true });
  await client.cancelReservation("fitspin", 1);
  expect(fetchMock).toHaveBeenLastCalledWith("https://example.test/api/me/brand/fitspin/reservation-future/1/cancel", expect.objectContaining({ method: "POST" }));
});
