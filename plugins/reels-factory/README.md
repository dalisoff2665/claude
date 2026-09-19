# Reels Factory — плагин Claude Code

Сырой дубль на входе — смонтированный вертикальный ролик на выходе.
Склейки ставятся по словным таймкодам, а не по сетке.

## Установка

```
/plugin marketplace add dalisoff2665/claude
/plugin install reels-factory@alisov-tools
```

Локально, без GitHub:

```
/plugin marketplace add ~/путь/к/reels-marketplace
/plugin install reels-factory@alisov-tools
```

Разово, для проверки: `claude --plugin-dir ~/путь/к/reels-marketplace/plugins/reels-factory`

## Зависимости

```bash
brew install ffmpeg yt-dlp node
pip3 install faster-whisper cloudinary

export AIRTABLE_PAT=...        # scope data.records:read+write, только на нужную базу
export CLOUDINARY_URL=...      # cloudinary://key:secret@cloud
```

Клади в `~/.zshrc` или в `.env` с `chmod 600`. В git — никогда.

## Команды

| Команда | Что делает |
|---|---|
| `/reels:init [имя]` | развернуть рабочую папку, проверить окружение, подтянуть ассеты |
| `/reels:ref <ссылка>` | разобрать чужой ролик: ритм, склейки, структура, раскадровка |
| `/reels:assets` | обновить музыку, SFX, фоны и лого из Airtable |
| `/reels:edl <тема>` | собрать монтажный план |
| `/reels:render` | провалидировать и отрендерить |
| `/reels:fix <что поменять>` | точечная правка плана и повторный рендер |
| `/reels:publish [recID]` | Cloudinary + запись в Airtable |

Скилл `reel-edit` подхватывается сам, когда разговор про монтаж — команды для него не обязательны.

## Цикл

```
/reels:init обзор-claude-code
# снял дубль → raw/aroll.mp4, скринкасты → raw/demo/, скриншоты → raw/shots/
/reels:ref https://instagram.com/reel/XXXX
/reels:edl как Claude Code монтирует рилсы за тебя
/reels:render
/reels:fix слайд 02 короче на 2 секунды, чип с лого Airtable на слове «база»
/reels:publish recXXXXXXXXXXXXXX
```

## Что внутри

- `skills/reel-edit/` — правила монтажа: склейка по словам, ритм, слайды, звук
- `scripts/` — транскрипт, разбор референса, индекс B-roll, валидатор, рендер, публикация
- `templates/remotion/` — композиция: слайды с мокапами, чипы с лого, субтитры, PiP
- `templates/edl.schema.json` — схема монтажного плана
- `reference/` — два разобранных эталона: слайды (01) и yapping (02)
- `SHOOT.md` — как снимать · `MCP.md` — какие MCP нужны и модель угроз
