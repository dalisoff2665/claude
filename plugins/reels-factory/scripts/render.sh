#!/usr/bin/env bash
# Рендер ролика из edl.json + нормализация громкости.
# Запускается ИЗ рабочей папки ролика. Скрипты берутся из каталога самого плагина.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

[ -f edl.json ] || { echo "нет edl.json в $(pwd) — запускай из рабочей папки ролика"; exit 1; }
[ -d remotion ] || { echo "нет папки remotion — сначала /reels:init"; exit 1; }

python3 "$HERE/validate_edl.py" edl.json

mkdir -p out
cd remotion
[ -d node_modules ] || npm install
npx remotion render src/index.ts Reel ../out/_raw.mp4 \
  --props="../edl.json" --concurrency=4 --jpeg-quality=92
cd ..

TARGET=$(python3 -c "import json;print(json.load(open('edl.json')).get('audio',{}).get('target_lufs',-14))")
ffmpeg -hide_banner -loglevel error -y -i out/_raw.mp4 \
  -af "loudnorm=I=${TARGET}:TP=-1.5:LRA=11" -c:v copy out/reel.mp4
rm -f out/_raw.mp4

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/reel.mp4)
SIZE=$(du -h out/reel.mp4 | cut -f1)
echo "✓ out/reel.mp4 — ${DUR%.*}с, $SIZE"
