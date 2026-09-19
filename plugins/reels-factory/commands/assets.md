---
description: Обновить каталог музыки, SFX, фонов и лого из Airtable
allowed-tools: Bash, Read
---

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/assets_sync.py"
```

Нужен `AIRTABLE_PAT` в окружении — PAT со scope `data.records:read`
и доступом **только** к базе `appspFv4OyALMTk8K`.

После синка скажи, сколько чего подтянулось. Если пусто — проверь,
что PAT видит базу, а не что скрипт сломан.
