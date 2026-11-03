---
description: Установить earshot на эту машину (один раз) — код, venv, модели ~1.1 ГБ
allowed-tools: Bash
---

Запусти установку через Bash с `run_in_background: true` и дождись завершения — она долгая (3–10 минут: torch и модели):

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh" $ARGUMENTS
```

`$ARGUMENTS` может быть `--no-models` — тогда без моделей, работают только `measure`, `sfx`, `kit`.

Если упало — покажи последнюю ошибку одной строкой и что сделать (скрипт сам пишет, чего не хватает: Python 3.10+ или ffmpeg).

После успеха скажи:
1. Перезапусти Claude Code — MCP-сервер `earshot` поднимется из плагина.
2. Проверка: `/mcp` → `earshot` → connected, 16 инструментов.
3. CLI без MCP: `~/.earshot/venv/bin/earshot doctor`.
