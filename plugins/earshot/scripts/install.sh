#!/usr/bin/env bash
# earshot — установка один раз на машину (macOS на Apple Silicon / Linux).
#   bash install.sh              код + venv + модели (~1.1 ГБ)
#   bash install.sh --no-models  без моделей: работают только measure, sfx, kit
#
# Куда ставит (всё в одной папке, удалить = rm -rf ~/.earshot):
#   ~/.earshot/src    исходники earshot, зафиксированный коммит
#   ~/.earshot/venv   отдельное окружение Python
#   ~/.earshot/hf     модели CLAP + AST (EARSHOT_HOME=~/.earshot)
set -euo pipefail

SHA="591fa3e028032e6dce56620a20e932e35667e8d8"   # earshot 0.4.0 — проверенный коммит, не main
REPO="https://github.com/Leonxlnx/earshot.git"
ROOT="${EARSHOT_ROOT:-$HOME/.earshot}"
MODELS=1
[ "${1:-}" = "--no-models" ] && MODELS=0

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
die()  { printf '\nearshot install: %s\n' "$*" >&2; exit 1; }

# 1. Python 3.10+ (системный python3 на macOS — 3.9, он не подходит)
PY=""
for c in python3.12 python3.11 python3.13 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    PY="$(command -v "$c")"; break
  fi
done
[ -n "$PY" ] || die "нужен Python 3.10+. На Mac: brew install python@3.12"
say "1/5 Python: $PY ($("$PY" -c 'import sys; print(sys.version.split()[0])'))"

# 2. ffmpeg — earshot читает через него любые аудио и видео
command -v ffmpeg >/dev/null 2>&1 || die "нужен ffmpeg. На Mac: brew install ffmpeg"

OS="$(uname -s)"; ARCH="$(uname -m)"
[ "$OS" = "Darwin" ] && [ "$ARCH" = "x86_64" ] && die "torch 2.6+ не собирается под Intel Mac — ставь на Apple Silicon или Linux-сервер"

# 3. Исходники на зафиксированном коммите
say "2/5 Исходники → $ROOT/src (коммит ${SHA:0:7})"
mkdir -p "$ROOT"
if [ -d "$ROOT/src/.git" ]; then
  git -C "$ROOT/src" fetch -q origin
else
  git clone -q "$REPO" "$ROOT/src"
fi
git -C "$ROOT/src" checkout -q "$SHA"
[ "$(git -C "$ROOT/src" rev-parse HEAD)" = "$SHA" ] || die "коммит не совпал с $SHA"

# 4. Отдельный venv + зависимости
say "3/5 venv и зависимости (torch CPU — самое долгое, 2–5 минут)"
[ -x "$ROOT/venv/bin/python" ] || "$PY" -m venv "$ROOT/venv"
VPY="$ROOT/venv/bin/python"
"$VPY" -m pip install -q --upgrade pip
if [ "$OS" = "Linux" ]; then
  # CPU-сборка: без CUDA-библиотек на несколько ГБ
  "$VPY" -m pip install -q torch --index-url https://download.pytorch.org/whl/cpu
else
  "$VPY" -m pip install -q torch          # macOS: колесо с PyPI уже CPU/MPS
fi
"$VPY" -m pip install -q -e "$ROOT/src[mcp]"   # без [llm]: загрузка аудио в Gemini не ставится

export EARSHOT_HOME="$ROOT"
EARSHOT="$ROOT/venv/bin/earshot"

# 5. Модели (зафиксированные ревизии, safetensors). Дальше грузятся только из кэша, Hub не трогается.
if [ "$MODELS" = 1 ]; then
  say "4/5 Модели CLAP + AST (~1.1 ГБ) → $ROOT/hf"
  "$EARSHOT" doctor --fetch
else
  say "4/5 Модели пропущены (--no-models)"
fi

# Проверка: звук из банка рендерится и проходит аудит
say "5/5 Проверка"
TMP="$(mktemp -d)"
"$EARSHOT" sfx render ui_pop/soft -o "$TMP/pop.wav" --pitch A4
rm -rf "$TMP"
"$EARSHOT" doctor | head -1

say "Готово."
cat <<EOF
  CLI:  $EARSHOT <команда>      (EARSHOT_HOME=$ROOT)
  MCP:  перезапусти Claude Code — сервер earshot поднимется из плагина сам
  Обновление: поменять SHA в этом скрипте и запустить его снова
EOF
