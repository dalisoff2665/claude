#!/usr/bin/env bash
# Скачать материалы канала Brain Maxed для рилса (обложки и куски роликов из Cloudinary).
# Куски режутся на стороне Cloudinary: so_ — старт, du_ — длительность.
set -euo pipefail
cd "$(dirname "$0")"
C=https://res.cloudinary.com/dm30hfevr
mkdir -p assets/thumbs assets/clips
for p in what-sugar-does/thumb-A what-sugar-does/thumb-B what-sugar-does/thumb-C \
         doomscrolling/thumb-A doomscrolling/thumb-B doomscrolling/thumb-C what-sugar-does-ru/thumb-zub; do
  curl -sSf -o "assets/thumbs/$(echo $p | tr '/' '_').jpg" "$C/image/upload/brain-maxed/$p.jpg"
done
for id in xbd0e2iGasA IXtLF0ioEeQ R2YPhtg7roU; do
  curl -sSf -o "assets/thumbs/yt-$id.jpg" "https://i.ytimg.com/vi/$id/maxresdefault.jpg"
done
clip() { curl -sSf -o "assets/clips/$1.mp4" "$C/video/upload/$2/brain-maxed/$3.mp4"; }
V="w_540,h_960,c_fill,q_auto:good,ac_none"
H="w_960,h_540,c_fill,q_auto:good,ac_none"
clip ai-01   "so_1,du_6,$V" shorts/ai-01-he-has-nothing
clip doom-01 "so_1,du_6,$V" shorts/doom-01-check-the-time
clip sugar-01 "so_2,du_6,$V" shorts/sugar-01-rush-myth
clip kids-04 "so_1,du_6,$V" shorts/kids-04-no-ending
clip donut   "so_20,du_8,$H" what-sugar-does/video-1080p
clip doom-long "so_40,du_8,$H" doomscrolling/video-preview
echo "✓ assets/"
