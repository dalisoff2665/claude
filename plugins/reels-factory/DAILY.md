# Ежедневная рутина: как поставить на автопилот

Одна команда `/reels:daily`, которую дёргает планировщик. Без n8n.

## Кто что делает

| | |
|---|---|
| **Планировщик** (launchd / cron) | будильник. Ничего не решает |
| **Скрипты** (`scripts/pipeline/`) | руки: Airtable, HeyGen, Cloudinary, WhatsApp |
| **Claude Code** | мозг: сценарий и монтажный план. И только |

Разделение не косметическое. Промпт собирается из заголовков чужих рилсов,
транскриптов и текстов идей — любая строка оттуда может содержать инструкцию.
Поэтому получатель WhatsApp зашит в окружение, запись в Airtable идёт
детерминированным кодом, а модель пишет JSON и текст.

## Установка

### 1. Окружение

```bash
# ~/.reels.env   chmod 600, вне git
export AIRTABLE_PAT=...        # scope data.records:read+write, ТОЛЬКО appspFv4OyALMTk8K
export CLOUDINARY_URL=...      # лучше upload preset на папку REELS_READY, не мастер-ключ
export ANTHROPIC_API_KEY=...   # отдельный ключ под конвейер, с лимитом в консоли
export GREENAPI_ID=...
export GREENAPI_TOKEN=...
export REELS_NOTIFY_CHAT=7XXXXXXXXXX@c.us    # ТВОЙ номер. Меняется только руками
export HEYGEN_API_KEY=...
export HEYGEN_AVATAR_ID=...    # Daniel Alisov — MAIN PODCAST
export HEYGEN_VOICE_ID=...
export REELS_ROOT=$HOME/reels
```

### 2. Рабочая папка

```bash
mkdir -p ~/reels/{jobs,logs}
cd ~/reels && python3 ~/.claude/plugins/reels-factory/scripts/assets_sync.py
```

### 3. Проверка вручную

Прежде чем ставить на расписание — прогони один раз руками:

```bash
source ~/.reels.env
~/.claude/plugins/reels-factory/scripts/pipeline/run_daily.sh scene 1
```

Должно: взять референс, написать сценарий, отрендерить, прислать в WhatsApp.
Если упало — в `~/reels/logs/` написано, на каком шаге.

### 4. Расписание

**На Mac** — launchd, `~/Library/LaunchAgents/kz.vibeagent.reels.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>kz.vibeagent.reels</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>source ~/.reels.env &amp;&amp; ~/.claude/plugins/reels-factory/scripts/pipeline/run_daily.sh scene 2</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardErrorPath</key><string>/tmp/reels.err</string>
</dict></plist>
```

```bash
launchctl load ~/Library/LaunchAgents/kz.vibeagent.reels.plist
```

**На сервере** — cron:

```
0 7 * * * . ~/.reels.env && ~/.claude/plugins/reels-factory/scripts/pipeline/run_daily.sh scene 2 >> ~/reels/logs/cron.log 2>&1
```

Учти: рендер Remotion тянет Chromium. На том же хосте, где n8n и сайты,
это отъест память в самый неудобный момент — держи конвейер на Mac
или на отдельном воркере.

## Что приходит тебе в WhatsApp

Видео файлом, подпись с темой и длиной, ссылка:

```
clony.agent-cleaner.com/approve?rec=recXXXXXXXXXXXXXX
```

Три кнопки на странице: **Одобрить** → в очередь на публикацию ·
**Переделать** → перезапуск с этапа EDL с твоим комментарием ·
**Искать ещё** → референс в `SKIP`, рутина берёт следующий.

## Экономика на 2 ролика в день

| | |
|---|---|
| Claude (сценарий + EDL, агентский цикл) | ~$0.6–1.2 за ролик |
| HeyGen | только если нет своего дубля |
| Airtable, Cloudinary, рендер | в текущих тарифах |
| **60 роликов в месяц** | **~$40–70** без HeyGen |

Агентский цикл дороже одиночного вызова примерно вдвое — это плата
за то, что Claude сам читает результаты шагов и реагирует на них.

## Модель угроз

- **Инъекция через чужой контент.** Заголовок рилса или транскрипт содержит
  инструкцию. Худшее, что она может — испортить один сценарий.
  Номер WhatsApp в окружении, Airtable-запись делает скрипт, публикация только
  по твоей кнопке.
- **Утечка `~/.reels.env`.** Отдаёт Airtable-базу, медиатеку Cloudinary,
  отправку WhatsApp от твоего имени и счёт Anthropic. `chmod 600`, вне git,
  в `.gitignore` до первого коммита. Ключи отдельные, не переиспользованные
  из других проектов.
- **Разгон расхода.** Зациклившийся агент жжёт токены. Лимит в консоли Anthropic
  обязателен, `COUNT` в `run_daily.sh` держи на 2–3.
- **Публикация без тебя.** Её нет: рутина доводит до статуса «На апрув» и молчит.
  Кнопка — твоя.

## Быстрый вариант и его цена

Можно дать Claude Code MCP Airtable и Green API напрямую и выбросить скрипты —
получится короче. Что откладываем: изоляцию получателя и детерминированную запись.
Риск: инъекция в чужом заголовке превращается в сообщение твоим клиентам ночью,
без тебя. Скрипты — примерно час работы, и они снимают этот сценарий полностью.
