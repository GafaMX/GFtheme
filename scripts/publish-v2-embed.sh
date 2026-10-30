#!/usr/bin/env bash
# Compila el IIFE de V2 y publica el puntero estable + el bundle stampado.
# La URL pública de los sitios NO cambia:
#   https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js
# Ese archivo es un loader. El IIFE va en gafa-sdk.bundle.<stamp>.js (path nuevo
# en jsDelivr = GitHub fresco, sin rotar ramas ni editar Elementor).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
sdk="$root/packages/react-sdk"
out="$root/docs/v2-sdk"
loader="$root/scripts/gafa-sdk-loader.js"

cd "$sdk"
npm run build:embed

mkdir -p "$out"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
bundle_name="gafa-sdk.bundle.${stamp}.js"

find "$out" -maxdepth 1 -name 'gafa-sdk.bundle.*.js' -delete
cp "$sdk/dist-embed/gafa-sdk.js" "$out/gafa-sdk.bundle.js"
cp "$sdk/dist-embed/gafa-sdk.js" "$out/$bundle_name"
if [[ -f "$sdk/dist-embed/gafa-sdk.css" ]]; then
  cp "$sdk/dist-embed/gafa-sdk.css" "$out/gafa-sdk.css"
fi
cp "$loader" "$out/gafa-sdk.js"

commit="$(git -C "$root" rev-parse HEAD)"
short="$(git -C "$root" rev-parse --short HEAD)"
bytes="$(wc -c < "$out/gafa-sdk.bundle.js" | tr -d ' ')"
{
  echo "commit=$commit"
  echo "short=$short"
  echo "built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "bytes=$bytes"
  echo "bundle=$bundle_name"
} > "$out/VERSION.txt"

echo "Published $out/gafa-sdk.js (loader, $(wc -c < "$out/gafa-sdk.js" | tr -d ' ') bytes)"
echo "Bundle $bundle_name ($bytes bytes) @ $short"
echo "Public URL unchanged: https://cdn.jsdelivr.net/gh/GafaMX/GFtheme@cdn-live/docs/v2-sdk/gafa-sdk.js"
