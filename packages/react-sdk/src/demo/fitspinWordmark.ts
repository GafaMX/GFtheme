/**
 * Wordmark de prueba: el canvas abraza el lockup (S + FITSPIN) para que
 * `margin: auto` lo deje en el mismo eje que “Casi listo”. El SVG anterior
 * medía 220px con el texto en x=0 y “FITSPIN” se veía corrido a la izquierda.
 */
export function fitspinWordmarkDataUri(fill = "#111827", muted = "#6b7280"): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="44" viewBox="0 0 168 44"><circle cx="20" cy="22" r="16" fill="#f2b705"/><text x="20" y="28" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="18" font-weight="800" fill="#111827">S</text><text x="42" y="18" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16" font-weight="800" fill="${fill}">FITSPIN</text><text x="42" y="34" font-family="ui-sans-serif,system-ui,sans-serif" font-size="7" font-weight="700" letter-spacing="1.05" fill="${muted}">CYCLING &amp; TRAINING</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
