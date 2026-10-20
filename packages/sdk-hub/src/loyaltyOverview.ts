import { collapseSites } from "./directory";
import { hostKind } from "./hosts";
import { studioName } from "./labels";

export type StudioLoyaltyRow = {
  company_id: number;
  name: string;
  host: string | null;
  env: "prod" | "dev";
  members: number;
  points: number;
  issued: number;
  movements: number;
  gold: number;
  silver: number;
  bronze: number;
  last_seen_at: string | null;
};

export type LoyaltyTotals = {
  studios: number;
  members: number;
  points: number;
  issued: number;
  movements: number;
};

export function buildLoyaltyOverview(input: {
  balances: Array<{ company_id: number; points: number; updated_at?: string | null }>;
  ledgers: Array<{ company_id: number; points: number }>;
  sites: Array<{ company_id: number; host: string; path?: string | null; last_seen_at?: string | null; name?: string }>;
  env?: "prod" | "dev" | "all";
}): { studios: StudioLoyaltyRow[]; totals: LoyaltyTotals } {
  const byCompany = new Map<number, StudioLoyaltyRow>();

  for (const row of input.balances) {
    const current = byCompany.get(row.company_id) ?? emptyStudio(row.company_id);
    current.members += 1;
    current.points += Number(row.points) || 0;
    if (row.points >= 800) current.gold += 1;
    else if (row.points >= 200) current.silver += 1;
    else current.bronze += 1;
    if ((row.updated_at ?? "") > (current.last_seen_at ?? "")) current.last_seen_at = row.updated_at ?? null;
    byCompany.set(row.company_id, current);
  }

  for (const row of input.ledgers) {
    const current = byCompany.get(row.company_id) ?? emptyStudio(row.company_id);
    current.movements += 1;
    if (row.points > 0) current.issued += row.points;
    byCompany.set(row.company_id, current);
  }

  const named = collapseSites(input.sites);
  for (const studio of byCompany.values()) {
    const site =
      named.find((item) => item.company_id === studio.company_id && item.name !== "Local") ??
      named.find((item) => item.company_id === studio.company_id);
    studio.name = site?.name ?? studioName(site?.host ?? null);
    studio.host = site?.host ?? null;
    studio.env = hostKind(studio.host);
  }

  const env = input.env ?? "all";
  const studios = [...byCompany.values()]
    .filter((row) => env === "all" || row.env === env)
    .sort((a, b) => b.points - a.points || b.members - a.members);

  return { studios, totals: summarizeStudios(studios) };
}

export function summarizeStudios(studios: StudioLoyaltyRow[]): LoyaltyTotals {
  return {
    studios: studios.length,
    members: studios.reduce((sum, row) => sum + row.members, 0),
    points: studios.reduce((sum, row) => sum + row.points, 0),
    issued: studios.reduce((sum, row) => sum + row.issued, 0),
    movements: studios.reduce((sum, row) => sum + row.movements, 0),
  };
}

function emptyStudio(companyId: number): StudioLoyaltyRow {
  return {
    company_id: companyId,
    name: "Estudio",
    host: null,
    env: "prod",
    members: 0,
    points: 0,
    issued: 0,
    movements: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    last_seen_at: null,
  };
}
