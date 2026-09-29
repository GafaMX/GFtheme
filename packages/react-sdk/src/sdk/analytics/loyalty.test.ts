import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLoyaltyBalance } from "./loyalty";

describe("fetchLoyaltyBalance", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lee puntos y nivel del Hub", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            points: 220,
            tier: { id: "silver", label: "Silver", min: 200 },
            recent: [{ event_name: "reservation.confirmed", points: 20, ts: "2026-08-27T12:00:00.000Z" }],
          }),
        ),
      ),
    );

    const balance = await fetchLoyaltyBalance({
      hubUrl: "https://hub.buq.partners/",
      companyId: 80,
      userId: 9,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://hub.buq.partners/v1/loyalty/balance?company_id=80&user_id=9",
      expect.objectContaining({ method: "GET" }),
    );
    expect(balance?.points).toBe(220);
    expect(balance?.tier.id).toBe("silver");
  });

  it("devuelve null si el Hub no responde", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(
      fetchLoyaltyBalance({ hubUrl: "https://hub.buq.partners", companyId: 80, userId: 1 }),
    ).resolves.toBeNull();
  });
});
