export type LoyaltyBalance = {
  points: number;
  tier: { id: string; label: string; min: number };
  recent: Array<{ event_name: string; points: number; ts: string }>;
};

export async function fetchLoyaltyBalance(input: {
  hubUrl: string;
  companyId: number;
  userId: number;
}): Promise<LoyaltyBalance | null> {
  const url = `${input.hubUrl.replace(/\/+$/, "")}/v1/loyalty/balance?company_id=${input.companyId}&user_id=${input.userId}`;
  try {
    const response = await fetch(url, { method: "GET", mode: "cors" });
    if (!response.ok) return null;
    const data = (await response.json()) as LoyaltyBalance & { ok?: boolean };
    if (typeof data.points !== "number") return null;
    return {
      points: data.points,
      tier: data.tier ?? { id: "bronze", label: "Bronze", min: 0 },
      recent: Array.isArray(data.recent) ? data.recent : [],
    };
  } catch {
    return null;
  }
}
