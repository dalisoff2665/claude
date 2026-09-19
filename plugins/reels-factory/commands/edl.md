---
description: Собрать монтажный план для ролика
argument-hint: "<тема ролика>"
allowed-tools: Bash, Read, Write, Edit, Glob
---

Собери `edl.json` на ролик про: **$ARGUMENTS**

Работай по скиллу `reel-edit` — он задаёт правила. Коротко порядок:

1. Прочитай `words.json`, `broll.json`, `assets.json`, разбор из `reference/`
   и схему `edl.schema.json`.
   - нет `words.json` → `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/transcribe.py" raw/aroll.mp4`
   - нет `broll.json` → `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/broll_index.py" raw/demo/`
   - пустые `moments` в `broll.json` → открой контакт-шиты через Read и заполни

2. Размети транскрипт на блоки, собери `cuts` (паузы, запинки, фальстарты).

3. Разложи timeline: слайды на шаги, чипы на названия инструментов,
   B-roll на демонстрации, PiP на финальное доказательство.
   Каждому элементу — `anchor_word` из `words.json`.

4. Субтитры по 2–5 слов, 1–2 слова в `highlight`.

5. Музыка и SFX из `assets.json`, музыка не громче −26 dB.

6. Провалидируй:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/validate_edl.py" edl.json
```

Чини, пока не зелёный. Потом покажи короткую сводку: длина, число планов,
средний план, сколько вырезал мёртвого времени. Не пересказывай весь JSON.
