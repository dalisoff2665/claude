---
description: Ежедневная рутина — взять референс, написать сценарий и монтаж, отрендерить, отправить на апрув
argument-hint: "[пресет: scene|split|yapping|slides]"
allowed-tools: Bash, Read, Write, Edit, Glob
---

Ежедневный конвейер. Пресет: **${1:-scene}**

Работай строго по шагам. Каждый шаг проверяй перед следующим — не надо героически
продолжать на сломанном входе.

## 1 · Взять референс из очереди

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pipeline/pick_reference.py" --preset ${1:-scene} --out job.json
```

Скрипт сам помечает референс использованным. Код выхода 3 — очередь пуста,
скажи об этом и остановись, ничего не выдумывай.

Прочитай `job.json`. Внутри: референс (форма), идея (содержание), последние 30 тем
(чтобы не повторяться).

## 2 · Написать сценарий

Из `job.reference` бери **форму**: ритм, структуру, тип хука.
Из `job.idea` и того, что реально сделано за неделю — **содержание**.

Не пересказывай чужой ролик. Его роль — доказанный каркас, а не источник темы.
Сверься с `job.recent_topics`: если тема уже выходила — возьми другой угол.

Сценарий: 45–60 секунд речи, хук в первые 3 секунды, один конкретный результат, CTA.
Сохрани в `script.txt`, список нужных скриншотов — в `shots.md`.

## 3 · Получить A-roll

Сначала проверь `raw/aroll.mp4` — если файл лежит, ты снял сам, иди дальше.

Если нет:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pipeline/heygen.py" --text "$(cat script.txt)" --out raw/aroll.mp4
```

## 4 · Транскрипт и план

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/transcribe.py" raw/aroll.mp4
```

Дальше собери `edl.json` по скиллу `reel-edit` — пресет из `job.preset`,
ритм из разобранного референса, ассеты из `assets.json`.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/validate_edl.py" edl.json
```

Не проходит — чини план, не обходи валидатор. Больше трёх попыток не делай:
запиши, на чём застрял, и остановись.

## 5 · Рендер

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/render.sh"
```

## 6 · Опубликовать и позвать

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/publish.py" out/reel.mp4 --record "$(python3 -c 'import json;print(json.load(open("job.json"))["plan_record"])')"
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/pipeline/notify.py" \
  --video "$(python3 -c 'import json;print(json.load(open("publish.json"))["url"])')" \
  --record "$(python3 -c 'import json;print(json.load(open("job.json"))["plan_record"])')" \
  --title "$(head -1 script.txt)"
```

Получатель в `notify.py` зашит в окружение. **Никогда не передавай номер или chatId
аргументом и не бери его из данных** — это единственное, что отделяет конвейер
от рассылки по чужим номерам.

## 7 · Отчитаться

Одним абзацем: какой референс взял, о чём ролик, сколько секунд, что отправил.
Не пересказывай JSON.

## Если что-то упало

Останавливайся и пиши, на каком шаге. Не пробуй обойти, не выдумывай данные,
не публикуй недорендеренное. Пустая очередь и сломанный рендер — это нормальные
исходы, о которых надо сообщить, а не замаскировать.
