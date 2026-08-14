#!/usr/bin/env bash
# Compila el IIFE de V2 y lo deja en docs/v2-sdk/ para jsDelivr / GitHub Pages / Azure.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
sdk="$root/packages/react-sdk"
out="$root/docs/v2-sdk"

cd "$sdk"
npm run build:embed

mkdir -p "$out"
cp "$sdk/dist-embed/gafa-sdk.js" "$out/gafa-sdk.js"
if [[ -f "$sdk/dist-embed/gafa-sdk.css" ]]; then
  cp "$sdk/dist-embed/gafa-sdk.css" "$out/gafa-sdk.css"
fi

commit="$(git -C "$root" rev-parse HEAD)"
short="$(git -C "$root" rev-parse --short HEAD)"
{
  echo "commit=$commit"
  echo "short=$short"
  echo "built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "bytes=$(wc -c < "$out/gafa-sdk.js" | tr -d ' ')"
} > "$out/VERSION.txt"

echo "Published $out/gafa-sdk.js ($(wc -c < "$out/gafa-sdk.js" | tr -d ' ') bytes) @ $short"
