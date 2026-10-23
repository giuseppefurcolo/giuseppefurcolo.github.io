#!/usr/bin/env bash
# scripts/download.sh  (SPEC.md phase 1.3). Requires jq and curl.
mkdir -p _raw/files
jq -r '.[] | [.kind,.role,.url] | @tsv' _raw/manifest.json | nl -w2 -s$'\t' | \
while IFS=$'\t' read -r n kind role url; do
  ext="${url##*.}"; ext="${ext%%\?*}"
  dest="_raw/files/${role}/${kind}-$(printf '%02d' "$n").${ext}"
  mkdir -p "$(dirname "$dest")"
  curl -sSL --fail -o "$dest" "$url" && echo "ok  $dest" || echo "FAIL $url"
done
