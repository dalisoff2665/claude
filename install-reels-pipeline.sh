#!/usr/bin/env bash
# Установка пайплайна автомонтажа saint4ai/reels-pipline-automotaj на чистую машину.
#
#   bash install-reels-pipeline.sh [каталог]
#
# По умолчанию ставит в ~/reels-pipline-automotaj.
# Linux (apt) и macOS (brew). Windows — ставить по SETUP.md вручную.
set -euo pipefail

REPO_URL="https://github.com/saint4ai/reels-pipline-automotaj"
DEST="${1:-$HOME/reels-pipline-automotaj}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# ── 1. Системные зависимости ────────────────────────────────────────────────
say "1/6 системные зависимости"
if ! have ffmpeg || ! have ffprobe; then
  if have brew; then
    brew install ffmpeg
  elif have apt-get; then
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends ffmpeg
  else
    echo "поставь ffmpeg вручную и запусти скрипт заново" >&2; exit 1
  fi
fi
have node || { echo "нужен Node >= 22: https://nodejs.org" >&2; exit 1; }
node_major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
[ "$node_major" -ge 22 ] || { echo "Node $(node -v) — нужен >= 22" >&2; exit 1; }
have python3 || { echo "нужен Python >= 3.10" >&2; exit 1; }
echo "  node $(node -v) · python $(python3 -V 2>&1 | cut -d' ' -f2) · ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)"

# ── 2. Клон ─────────────────────────────────────────────────────────────────
say "2/6 репозиторий → $DEST"
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" pull --ff-only
else
  git clone "$REPO_URL" "$DEST"
fi
cd "$DEST"

# ── 3. Шрифты ───────────────────────────────────────────────────────────────
# В репозитории лежат только лицензии. Manrope, JetBrains Mono и STIX Two Text —
# OFL, тянем из Google Fonts. Benzin (запасной H1) проприетарный, его не ставим.
say "3/6 шрифты (Manrope, JetBrains Mono, STIX Two Text — все с кириллицей)"
GF="https://raw.githubusercontent.com/google/fonts/main/ofl"
[ -f fonts/Manrope-Variable.ttf ] || \
  curl -fsSL -o fonts/Manrope-Variable.ttf "$GF/manrope/Manrope%5Bwght%5D.ttf"
[ -f fonts/JetBrainsMono-Variable.ttf ] || \
  curl -fsSL -o fonts/JetBrainsMono-Variable.ttf "$GF/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"

python3 - <<'PY'
import os, re, urllib.request
want = {"cyrillic": "fonts/stix-two-text-cyrillic-700-italic.woff2",
        "latin":    "fonts/stix-two-text-latin-700-italic.woff2"}
if all(os.path.exists(p) for p in want.values()):
    raise SystemExit
ua = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
url = "https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@1,700&display=swap"
css = urllib.request.urlopen(urllib.request.Request(url, headers=ua)).read().decode()
for name, body in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S):
    if name in want:
        u = re.search(r"url\((https://[^)]+)\)", body).group(1)
        data = urllib.request.urlopen(urllib.request.Request(u, headers=ua)).read()
        open(want[name], "wb").write(data)
PY

python3 - <<'PY'
try:
    from fontTools.ttLib import TTFont
except ImportError:
    print("  (fontTools не установлен — пропускаю проверку кириллицы)"); raise SystemExit
for p in ("fonts/Manrope-Variable.ttf", "fonts/JetBrainsMono-Variable.ttf"):
    cm = TTFont(p, lazy=True).getBestCmap()
    n = sum(1 for c in range(0x410, 0x450) if c in cm)
    print(f"  {p}: {n}/64 кириллицы" + ("" if n == 64 else "  ← ПРОБЛЕМА"))
PY

# ── 4. Gilroy ───────────────────────────────────────────────────────────────
# Gilroy выведен из системы (платный, в репозиторий не идёт), но остался
# fallback'ом в сборщике и в parts/scenes.css. Из-за этого линтер валит любой
# новый проект ошибкой font_family_without_font_face. Убираем fallback.
say "4/6 убираю мёртвый fallback на Gilroy"
for f in scripts/assemble.py videos/reels-1-composio/parts/scenes.css; do
  [ -f "$f" ] && sed -i.bak \
    -e 's/"Manrope","Gilroy",Arial,sans-serif/"Manrope",Arial,sans-serif/g' \
    -e 's/"Manrope","Gilroy",sans-serif/"Manrope",sans-serif/g' "$f" && rm -f "$f.bak"
done

# ── 5. Python и браузер ─────────────────────────────────────────────────────
say "5/6 зависимости face/safe-zone QA и Chrome Headless Shell"
python3 -m pip install --quiet --disable-pip-version-check \
  -r scripts/requirements-face-qa.txt fontTools
npx --yes hyperframes@0.8.20 browser ensure

# ── 6. Проверка ─────────────────────────────────────────────────────────────
say "6/6 проверка"
npx --yes hyperframes@0.8.20 doctor || true
echo
python3 scripts/pipe.py --about | head -3
bash scripts/check-secrets.sh || true

cat <<EOF

Готово. Каталог: $DEST

  cd $DEST
  bash scripts/new-reel.sh <id>                       # новый проект из эталона
  bash scripts/fonts.sh videos/<id>                   # шрифты в проект
  python3 scripts/pipe.py build videos/<id>           # assemble → validate → lint → check
  bash scripts/render-safe.sh videos/<id> out.mp4     # рендер (запускает человек)

Красные строки в doctor — whisper-cpp, TTS, BGM, Docker — опциональные,
для монтажа не нужны. Медиа и Benzin в репозиторий не входят.
EOF
