---
description: "Собрать длинное видео 16:9 локально из голоса, кадров и музыки"
argument-hint: "[номер видео]"
---
Открой скилл yt-edit для: `$ARGUMENTS`. Составь `edit.json` по `subs.srt` и шотам, собери `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/assemble.py" edit.json --out out/video.mp4`, затем `--sheet out/sheet.jpg` и обязательно открой контакт-лист через Read.
