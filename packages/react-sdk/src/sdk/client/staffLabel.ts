export type StaffLabelSource = {
  /** Admin label "Título" — v1 lo usa como apodo en calendario y reservas. */
  job?: string | null;
  apodo?: string | null;
  name?: string | null;
  lastname?: string | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/**
 * Nombre visible del coach, igual que v1: si hay Título (`job` / `apodo`)
 * se usa ese en lugar del nombre legal.
 */
export function staffLabel(staff?: StaffLabelSource | null): string | undefined {
  if (!staff) return undefined;
  const nickname = firstNonEmpty(staff.job, staff.apodo);
  if (nickname) return nickname;
  const name = [staff.name, staff.lastname]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" ")
    .trim();
  return name || undefined;
}
