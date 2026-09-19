#!/usr/bin/env bash
# Будильник для рутины. Вызывается планировщиком, сам ничего не решает.
#
#   ./run_daily.sh scene 2
#              пресет ─┘    └─ сколько роликов за прогон
set -uo pipefail

PRESET="${1:-scene}"
COUNT="${2:-2}"
ROOT="${REELS_ROOT:-$HOME/reels}"
PLUGIN="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/reels-factory}"
LOG="$ROOT/logs/$(date +%F).log"

mkdir -p "$ROOT/logs"

for i in $(seq 1 "$COUNT"); do
  JOB="$ROOT/jobs/$(date +%F)-$i"
  mkdir -p "$JOB" && cd "$JOB"

  # ассеты обновляем раз в прогон, не на каждый ролик
  [ -f "$ROOT/assets.json" ] || python3 "$PLUGIN/scripts/assets_sync.py" >/dev/null 2>&1
  cp -n "$ROOT/assets.json" . 2>/dev/null || true
  cp -rn "$PLUGIN/reference" . 2>/dev/null || true
  cp -rn "$PLUGIN/templates/remotion" . 2>/dev/null || true

  echo "=== $(date +%T) job $i · пресет $PRESET" | tee -a "$LOG"

  claude -p "/reels:daily $PRESET" \
    --output-format text \
    --allowedTools "Bash,Read,Write,Edit,Glob" \
    >>"$LOG" 2>&1

  code=$?
  if [ $code -ne 0 ]; then
    echo "!!! job $i упал, код $code — см. $LOG" | tee -a "$LOG"
    break
  fi
done

echo "=== $(date +%T) прогон завершён" | tee -a "$LOG"
