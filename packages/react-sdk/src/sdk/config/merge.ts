export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Overlay gana. Arrays y primitivos se reemplazan; objetos se mezclan. `undefined` no pisa. */
export function deepMerge<T>(base: T, overlay: unknown): T {
  if (overlay === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay as T;
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) continue;
    next[key] = isPlainObject(next[key]) && isPlainObject(value) ? deepMerge(next[key], value) : value;
  }
  return next as T;
}
