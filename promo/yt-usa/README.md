# Рилс «Все говорят про американский YouTube с ИИ — я попробовал»

Формат как у saint4ai («11 бесплатных навыков Claude для YouTube»): голос за кадром + моушн-графика,
прогрессивные субтитры, кодовое слово в конце. В кадре — примеры роликов моего канала:
обложки, шортс и куски роликов из Cloudinary. 62 с, 1080×1920, −14 LUFS.

| Файл | Что это |
|---|---|
| `script.json` | сценарий по сценам; `видно\|произносится` для слов, которые TTS читает иначе |
| `fetch_assets.sh` | скачать обложки и куски роликов канала из Cloudinary в `assets/` (не в git) |
| `tts_edge.py` | бесплатная озвучка голосом Microsoft (edge-tts) с таймкодами слов → `build/voice.wav`, `build/timeline.json` |
| `tts.py` | то же через Cartesia (нужен баланс) |
| `retime.py` | **переозвучка своим голосом**: запись → faster-whisper → новый `timeline.json` |
| `reel.html` | 12 сцен в дизайн-системе VibeAgent, анимация по таймкодам слов |
| `render.cjs` | headless Chromium снимает кадры → ffmpeg |
| `mix.py` | голос + тихий пэд + звуки из `build/sfx.json` (вжухи, щелчки, удары) → `out/reel.mp4` и `out/reel_voice_only.mp4` |
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
./fetch_assets.sh
for c in ai-01 doom-01 sugar-01 kids-04 donut doom-long; do mkdir -p assets/frames/$c && ffmpeg -v error -y -i assets/clips/$c.mp4 -vf fps=30 -q:v 4 assets/frames/$c/%04d.jpg; done
ffmpeg -y -i assets/thumbs/doomscrolling_thumb-B.jpg -vf "crop=340:340:690:110,scale=300:300" assets/avatar.jpg
python3 tts_edge.py script.json --voice en-US-AndrewMultilingualNeural --rate +25%
node render.cjs --stills 4.9,18.6,38.9   # проверочные кадры в build/
node render.cjs && python3 mix.py
```

Нужны Node 18+, Playwright (`npm i playwright && npx playwright install chromium`), ffmpeg, Python 3.
