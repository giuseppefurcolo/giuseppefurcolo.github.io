#!/usr/bin/env bash
# scripts/optimize.sh  (SPEC.md phase 2)
# Converts _raw/files/ into committed assets/. Run from the repo root.
# Requires: brew install imagemagick ffmpeg
# Usage: scripts/optimize.sh [images|videos|extras|all]   (default: all)
set -euo pipefail
what="${1:-all}"

# images: strip stills -> AVIF + WebP at 1x (800) and 2x (1600)
# embed-* files are posters for click-to-load iframes and get the same treatment
images() {
  for src in _raw/files/*/image-* _raw/files/*/bg-* _raw/files/*/embed-*; do
    [ -f "$src" ] || continue
    case "$src" in *.gif) continue ;; esac   # animated GIFs are converted to MP4 below
    role=$(basename "$(dirname "$src")")
    stem=$(basename "${src%.*}")
    out="assets/work/$role"; mkdir -p "$out"
    for w in 1600 800; do
      sfx=$([ $w = 1600 ] && echo "@2x" || echo "")
      magick "$src[0]" -resize "${w}x${w}>" -strip -quality 55 "$out/${stem}${sfx}.avif"
      magick "$src[0]" -resize "${w}x${w}>" -strip -quality 78 "$out/${stem}${sfx}.webp"
    done
    echo "img  $out/$stem"
  done
}

# videos: MP4 H.264, no audio, max 1280 wide, plus a WebP poster
# animated GIFs go through the same path so they play like the other strip videos
video_one() {
  local src="$1" crf="${2:-26}" extra="${3:-}"
  role=$(basename "$(dirname "$src")")
  stem=$(basename "${src%.*}")
  stem="${stem/image-/video-}"
  out="assets/work/$role"; mkdir -p "$out"
  # shellcheck disable=SC2086
  ffmpeg -v error -y -i "$src" -an $extra \
    -vf "scale='min(1280,iw)':-2,fps=30" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow -crf "$crf" \
    -movflags +faststart "$out/${stem}.mp4"
  # Homebrew ffmpeg ships without libwebp, so hand the frame to ImageMagick
  ffmpeg -v error -y -ss 0.5 -i "$out/${stem}.mp4" -frames:v 1 -f image2pipe -c:v png - \
    | magick png:- -resize '960x960>' -strip -quality 72 "$out/${stem}-poster.webp"
  echo "vid  $out/$stem  $(du -h "$out/${stem}.mp4" | cut -f1)"
}
videos() {
  for src in _raw/files/*/video-* _raw/files/*/image-*.gif; do
    [ -f "$src" ] || continue
    video_one "$src"
  done
}

# extras: logos, fonts, favicon source
extras() {
  mkdir -p assets/logos assets/favicon
  for src in _raw/files/*/logo.svg; do
    cp "$src" "assets/logos/$(basename "$(dirname "$src")").svg"
  done
  for src in _raw/files/*/logo-*.jp*g; do
    magick "$src" -resize "160x160>" -strip -quality 85 "assets/logos/$(basename "$(dirname "$src")").webp"
  done
  cp _raw/files/celtra/wordmark.svg assets/work/celtra/wordmark.svg
}

case "$what" in
  images) images ;;
  videos) videos ;;
  extras) extras ;;
  all) images; videos; extras ;;
esac

# favicon (run manually; the Framer source is a 96px raster, no vector exists)
# f=_raw/files/global/favicon-54.png
# magick "$f" -define icon:auto-resize=48,32,16 assets/favicon/favicon.ico
# magick "$f" -strip assets/favicon/favicon-96.png
# magick "$f" -background white -alpha remove -filter Lanczos -resize 180x180 -strip assets/favicon/apple-touch-icon.png

# one-off override: the LaunchScience backdrop shows wider than 1600px, so its 2x keeps native width
# magick _raw/files/launchscience/embed-lsd.png -strip -quality 55 assets/work/launchscience/01-bg@2x.avif
# magick _raw/files/launchscience/embed-lsd.png -strip -quality 78 assets/work/launchscience/01-bg@2x.webp
