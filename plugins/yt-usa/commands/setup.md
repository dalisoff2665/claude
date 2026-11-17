---
description: "Проверить, что подключено для американского YouTube: vidIQ, канал, кредиты, генераторы, ffmpeg"
argument-hint: ""
---
Проверь окружение для пакета yt-usa и скажи, чего не хватает. Ничего не устанавливай сам без согласия.

1. vidIQ: вызови `vidiq_get_profile` и `vidiq_balance` (0 кредитов). Инструментов `vidiq_*` нет — покажи раздел «vidIQ» из `${CLAUDE_PLUGIN_ROOT}/MCP.md`.
2. Канал: `vidiq_user_channels`. Пустой список — предложи `vidiq_connect_youtube_channel` и назови аккаунт из `authenticatedAs`.
3. Генераторы: найди через поиск инструментов картинки (`nano_banana_image`, `bytedance_seedream_image`, `gpt_image_2`, `gemini_generate_image`), видео (`veo3_generate_video`, `kling_video`, `bytedance_seedance_video`), голос (`elevenlabs_tts`, HeyGen `create_speech`). Отметь, что есть.
4. Локально: `ffmpeg -version`, `python3 -c "import faster_whisper"`. Нет faster-whisper — дай команду `pip install faster-whisper`.
5. Ответ — таблица «есть / нет / что сделать», остаток кредитов и одна строка «Следующий шаг: …».
