---
description: Развернуть рабочую папку под новый ролик в текущей директории
argument-hint: "[название-ролика]"
allowed-tools: Bash, Read, Write
---

Разверни рабочую папку для нового ролика.

1. Создай структуру в текущей директории (или в подпапке `$1`, если аргумент передан):

```bash
mkdir -p raw/demo raw/shots reference out
cp -r "${CLAUDE_PLUGIN_ROOT}/templates/remotion" .
cp "${CLAUDE_PLUGIN_ROOT}/templates/edl.schema.json" .
cp "${CLAUDE_PLUGIN_ROOT}/templates/"edl.*.json .
cp "${CLAUDE_PLUGIN_ROOT}/reference/"*.md reference/
printf '.env\nnode_modules/\nraw/\nout/\nwords.json\nassets.json\nbroll_sheets/\n' > .gitignore
```

2. Проверь окружение и скажи, чего не хватает:

```bash
for b in ffmpeg ffprobe yt-dlp node; do command -v $b >/dev/null || echo "нет: $b"; done
python3 -c "import faster_whisper" 2>/dev/null || echo "нет: faster-whisper (pip3 install faster-whisper)"
[ -n "$AIRTABLE_PAT" ] || echo "нет: AIRTABLE_PAT в окружении"
[ -n "$CLOUDINARY_URL" ] || echo "нет: CLOUDINARY_URL в окружении"
```

3. Если `AIRTABLE_PAT` есть — сразу подтяни ассеты:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/assets_sync.py"
```

4. Коротко скажи, что класть в `raw/`: один непрерывный дубль в `raw/aroll.mp4`,
сырые неускоренные скринкасты в `raw/demo/`, скриншоты для слайдов в `raw/shots/`.
Подробности — в `${CLAUDE_PLUGIN_ROOT}/SHOOT.md`, покажи только если спросят.

Не пересоздавай то, что уже есть. Ничего не перезаписывай без спроса.
