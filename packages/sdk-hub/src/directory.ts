import { personAlias, studioName } from "./labels";

export type DirectorySite = {
  key: string;
  company_id: number;
  host: string;
  path: string;
  name: string;
  last_seen_at: string | null;
};

export type DirectoryPerson = {
  company_id: number;
  user_id: number;
  alias: string;
  name: string;
  host: string | null;
  last_seen_at: string | null;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function preferPublicHost(current: string | null | undefined, incoming: string | null | undefined): string | null {
  const next = incoming?.trim() || null;
  const prev = current?.trim() || null;
  if (!next) return prev;
  if (!prev) return next;
  if (LOCAL_HOSTS.has(next) && !LOCAL_HOSTS.has(prev)) return prev;
  return next;
}

export function siteFromRow(row: {
  company_id: number;
  host: string;
  path?: string | null;
  last_seen_at?: string | null;
}): DirectorySite {
  const path = row.path || "/";
  const host = row.host || "localhost";
  const first = path.split("/").filter(Boolean)[0] ?? "";
  return {
    key: `${row.company_id}|${host.toLowerCase()}|${first}`,
    company_id: row.company_id,
    host,
    path,
    name: studioName(host, path),
    last_seen_at: row.last_seen_at ?? null,
  };
}

export function collapseSites(rows: Array<{ company_id: number; host: string; path?: string | null; last_seen_at?: string | null }>): DirectorySite[] {
  const byCompany = new Map<number, DirectorySite>();
  let local: DirectorySite | null = null;
  for (const row of rows) {
    const site = siteFromRow(row);
    if (site.name === "Local") {
      if (!local || (site.last_seen_at ?? "") > (local.last_seen_at ?? "")) local = site;
      continue;
    }
    const prev = byCompany.get(site.company_id);
    if (!prev) {
      byCompany.set(site.company_id, site);
      continue;
    }
    const newer = (site.last_seen_at ?? "") > (prev.last_seen_at ?? "");
    const prevGeneric = prev.host.includes("buq.") || prev.host.includes("replit") || prev.host.includes("workers.dev");
    const nextBranded = !site.host.includes("buq.") && !site.host.includes("replit") && !site.host.includes("workers.dev");
    if ((nextBranded && prevGeneric) || (newer && !(prev.host && !prevGeneric && site.host.includes("buq.")))) {
      byCompany.set(site.company_id, { ...site, name: site.name === "Local" ? prev.name : site.name });
    }
  }
  const sites = [...byCompany.values()];
  if (local) sites.push(local);
  return sites.sort((a, b) => {
    if (a.name === "Local" && b.name !== "Local") return 1;
    if (b.name === "Local" && a.name !== "Local") return -1;
    return a.name.localeCompare(b.name, "es");
  });
}

export function presentPerson(row: {
  company_id: number;
  user_id: number;
  display_name?: string | null;
  last_host?: string | null;
  last_seen_at?: string | null;
  path?: string | null;
}): DirectoryPerson {
  const alias = personAlias(row.company_id, row.user_id);
  const studio = studioName(row.last_host, row.path);
  return {
    company_id: row.company_id,
    user_id: row.user_id,
    alias,
    name: row.display_name?.trim() || `${studio} · ${alias}`,
    host: row.last_host ?? null,
    last_seen_at: row.last_seen_at ?? null,
  };
}
