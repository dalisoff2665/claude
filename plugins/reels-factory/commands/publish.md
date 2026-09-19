---
description: Залить готовый ролик в Cloudinary и записать в Airtable
argument-hint: "[recID записи в CONTENT PLAN]"
allowed-tools: Bash, Read
---

Опубликуй `out/reel.mp4`.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/publish.py" out/reel.mp4 ${1:+--record $1}
```

Если recID не передан — только залей в Cloudinary и верни ссылку.

Секреты (`CLOUDINARY_URL`, `AIRTABLE_PAT`) читаются из окружения.
Никогда не выводи их значения и не вставляй в команду напрямую.
