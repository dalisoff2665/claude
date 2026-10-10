# alisov-tools

Плагины Даниэля Алисова для Claude Code.

## Установка

```
/plugin marketplace add dalisoff2665/claude
/plugin install reels-factory@alisov-tools
/plugin install security-audit@alisov-tools
```

## Обновление

```
/plugin marketplace update alisov-tools
```

Одна команда на любой машине. Новая версия подтягивается из этого репозитория.

## reels-factory

Монтаж вертикальных роликов. Сырой дубль на входе — смонтированное видео на выходе.
Склейки ставятся по словным таймкодам, а не по сетке.

### Пять пресетов

| Пресет | Референс | Средний план | Особенность |
|---|---|---|---|
| `slides` | petkova_anjela | 3.2 с | мокапы окон, eyebrow-счётчик |
| `yapping` | aiwithsachi | 1.7 с | субтитры по одному слову |
| `split` | saint4ai | 5.7 с | панель 50% + живое селфи |
| `scene` | saint4ai | 3.5 с | бейджи накапливаются, карточка спикера |
| `cutout` | nick_saraev | 1.4 с | человек поверх карточки, голова за краем |
| `story` | — | — | поездки: фото с телефона, Ken Burns |

Каждый референс разобран с замерами: ритм, склейки, палитра пипеткой, геометрия.
Лежат в `plugins/reels-factory/reference/`.

### Команды

| | |
|---|---|
| `/reels:init` | развернуть рабочую папку |
| `/reels:ref <ссылка>` | разобрать чужой ролик на ритм и структуру |
| `/reels:edl <тема>` | собрать монтажный план |
| `/reels:render` | валидация и рендер |
| `/reels:fix <что>` | точечная правка |
| `/reels:publish` | Cloudinary + Airtable |
| `/reels:trip` | ролик из фото с телефона |
| `/reels:daily` | ежедневная рутина целиком |

### Документация

- `DAILY.md` — автопилот: launchd, cron, что приходит в WhatsApp
- `AIRTABLE.md` — формулы дедупликации, статусы, кнопки апрува
- `SHOOT.md` — что и как снимать под каждый пресет
- `MCP.md` — какие MCP нужны, какие нет, модель угроз
- `templates/wrapper/` — Claude Code как сервис для n8n

## security-audit

Скилл Cloudflare для аудита безопасности кода ([cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill), MIT).
Шесть фаз: разведка → охота по классам атак → независимая валидация → `findings.json` по схеме → перепроверка → отчёт.

Запуск: «security audit this codebase» или «найди уязвимости в ./src».
Отчёты по умолчанию пишутся в `~/security-audit-skill/<repo>/run-N`, вне репозитория.
Чужой код запускается только в песочнице без сети; иначе находка остаётся `needs_validation`.

Обновить из upstream: заменить `plugins/security-audit/skills/security-audit/` свежей копией и поднять версию в обоих манифестах.

## AI Research Skills (внешний marketplace)

[orchestra-research/AI-research-SKILLs](https://github.com/orchestra-research/AI-research-SKILLs), MIT: 98 скиллов в 23 плагинах.
Подключён в `.claude/settings.json` с фиксацией на тег `v1.7.2`. В этом репо включены:
`agents`, `rag`, `prompt-engineering`, `observability`, `inference-serving`, `safety-alignment`.

Глобально на своей машине:

```
/plugin marketplace add orchestra-research/AI-research-SKILLs@v1.7.2
/plugin install agents@ai-research-skills
```

Остальные плагины (`fine-tuning`, `post-training`, `multimodal`, `evaluation`, `mlops`, `autoresearch` и т.д.) ставятся так же.
Обновление: поднять `ref` в `.claude/settings.json` после просмотра диффа upstream.

## Выпуск новой версии

```bash
./release.sh 1.1.1 "что изменилось"
```

Поднимает версию в обоих манифестах, коммитит, ставит тег, пушит.
