/** Cuántas clases del historial se ven antes de “Ver más”. */
export const ACCOUNT_HISTORY_CHUNK = 10;

export function visibleAccountHistory<T>(items: T[], shown: number): T[] {
  if (shown >= items.length) return items;
  return items.slice(0, Math.max(0, shown));
}

export function remainingAccountHistory(total: number, shown: number): number {
  return Math.max(0, total - shown);
}
