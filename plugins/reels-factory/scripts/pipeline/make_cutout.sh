#!/usr/bin/env bash
# Готовит A-roll с альфа-каналом для пресета cutout.
#
#   ./make_cutout.sh raw/aroll.mp4 green     — снято на зелёном экране
#   ./make_cutout.sh raw/aroll.mp4 rembg     — снято на любом ровном фоне
#
# Отдаёт raw/aroll.webm — его и указываешь в edl.aroll
set -euo pipefail
SRC="${1:?укажи исходник}"
MODE="${2:-green}"
OUT="${SRC%.*}.webm"

case "$MODE" in
  green)
    # ключуем зелёный. similarity 0.30 — стартовая, подбирай по своему свету
    ffmpeg -hide_banner -y -i "$SRC" \
      -vf "colorkey=0x00FF00:0.30:0.10,despill=type=green" \
      -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 3M -c:a libopus "$OUT"
    ;;
  rembg)
    command -v rembg >/dev/null || { echo "pip3 install 'rembg[cli]'"; exit 1; }
    TMP=$(mktemp -d)
    ffmpeg -hide_banner -loglevel error -y -i "$SRC" "$TMP/%05d.png"
    echo "→ вырезаю фон покадрово, это долго"
    rembg p "$TMP" "$TMP/out"
    ffmpeg -hide_banner -y -framerate 30 -i "$TMP/out/%05d.png" -i "$SRC" \
      -map 0:v -map 1:a -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 3M -c:a libopus "$OUT"
    rm -rf "$TMP"
    ;;
  *) echo "режим: green | rembg"; exit 1 ;;
esac

echo "✓ $OUT — укажи его в edl.aroll"
