# Рилс «Запускаю американский YouTube — всё делает Claude»

Формат как у saint4ai («11 бесплатных навыков Claude для YouTube»): голос за кадром + моушн-графика,
прогрессивные субтитры, кодовое слово в конце. 52.8 с, 1080×1920, −14 LUFS.

| Файл | Что это |
|---|---|
| `script.json` | сценарий по сценам; `видно\|произносится` для слов, которые TTS читает иначе |
| `tts.py` | черновая озвучка Cartesia с таймкодами слов → `build/voice.wav`, `build/timeline.json` |
| `retime.py` | **переозвучка своим голосом**: запись → faster-whisper → новый `timeline.json` |
| `reel.html` | 12 сцен в дизайн-системе VibeAgent, анимация по таймкодам слов |
| `render.cjs` | headless Chromium снимает кадры → ffmpeg |
| `mix.py` | голос + тихий пэд + «вжухи» на сменах сцен → `out/reel.mp4` и `out/reel_voice_only.mp4` |
| `FUNNEL.md` | подпись, закреп, ответы, директ, дожимы |
| `guide/index.html` | гайд, который уходит в директ по слову ЮТУБ |

## Переозвучить своим голосом (рекомендуется перед публикацией)

1. Запиши текст из `script.json` (правую часть после `|`) одним дублем — или озвучь клоном HeyGen «Daniel Alisov — 18».
2. `pip install faster-whisper` (один раз).
3. `python3 retime.py мой_голос.m4a` — увидишь «совпало слов: 9x%».
4. `node render.cjs && python3 mix.py` — новый `out/reel.mp4` за ~2 минуты.

Сцены и субтитры сами встанут под твой темп.

## Пересобрать с нуля

```bash
python3 tts.py script.json --out build/ --tempo 1.05
node render.cjs --stills 4.9,18.6,38.9   # проверочные кадры в build/
node render.cjs && python3 mix.py
```

Нужны Node 18+, Playwright (`npm i playwright && npx playwright install chromium`), ffmpeg, Python 3.
