# earshot — слух для агента

Обёртка над [Leonxlnx/earshot](https://github.com/Leonxlnx/earshot) 0.4.0 (MIT, автор Leon Lin).
Claude не слышит звук. earshot превращает звук в цифры и слова: что звучит, где лучший момент,
попадает ли удар в склейку, как звук ролика выглядит рядом с профессиональными.

## Установка

```
/plugin marketplace update alisov-tools
/plugin install earshot@alisov-tools
/earshot:setup
```

`/earshot:setup` — один раз на машину, 3–10 минут. Нужны Python 3.10+ и ffmpeg
(`brew install python@3.12 ffmpeg`). Mac только на Apple Silicon: torch 2.6+ не собирается под Intel.
После установки перезапусти Claude Code, в `/mcp` появится `earshot` с 16 инструментами.

Всё ставится в `~/.earshot`: исходники на зафиксированном коммите, свой venv, модели CLAP и AST (~1.1 ГБ).
Удалить: `rm -rf ~/.earshot` и `/plugin uninstall earshot@alisov-tools`.

## Что умеет

| Задача | Инструмент | Нужны модели |
|---|---|---|
| Громкость, true peak, LUFS, спектр, темп | `measure` | нет |
| 252 звука в коде: whoosh, pop, click, hit, riser, shutter, mallet | `sfx_list`, `sfx_render` | нет |
| Кит звуков под ролик с замеренными точками синхрона (`launch` — под монтаж на музыку) | `kit_render` | нет |
| Что звучит, словами | `describe` | да |
| Насколько звук подходит под описание, выбрать лучший из папки | `match`, `rank` | да |
| Лучший момент в длинной записи, готовые точки обрезки | `find` | да |
| Расшифровка звука ролика по секундам, синхрон со склейками | `timeline`, `sheet` | да |
| Оценка звука ролика против 7 профессиональных launch-фильмов | `critique` | да |
| Живая запись или синтез | `realness` | да |

Скиллы: `earshot` (как слушать) и `real-sound` (полный процесс саунд-дизайна из лицензированных записей).

### Связка с reels-factory

- Звук на склейки: `kit init --preset launch` → `kit render` — 72 дубля с замеренными onset / peak / end,
  ставятся в Remotion по кадрам из EDL.
- Проверка готового рилса: `timeline reel.mp4` и `sheet reel.mp4 -o sheet.png` — видно, где удар опоздал,
  где тишина, где музыка забивает голос.

## Модель угроз

- **Кто достучится.** Никто снаружи: MCP-сервер работает через stdio, сетевого порта нет.
- **Чужой код.** earshot исполняется с твоими правами. Поэтому исходники зафиксированы на коммите
  `591fa3e` (0.4.0), а не на `main`: обновление апстрима само не приедет. Обновлять — поменять `SHA`
  в `scripts/install.sh`, посмотреть дифф, перезапустить установку.
- **Сеть.** Нужна только при установке: GitHub, PyPI, download.pytorch.org (Linux), huggingface.co
  (модели на зафиксированных ревизиях, только safetensors). Дальше earshot читает модели из кэша и в Hub не ходит.
- **Утечка звука.** Единственный инструмент, который отправляет аудио наружу, — `llm_critique` (Gemini).
  Согласие на загрузку агент может выставить сам, поэтому обёртка убирает `GEMINI_API_KEY` и `GOOGLE_API_KEY`
  из окружения сервера. Включить осознанно: запустить Claude Code с `EARSHOT_ALLOW_LLM=1`.
- **Скачанные файлы.** Сервер запускается с `python -I`: файлы из папки проекта не подменят модули Python.

## Обновление earshot

1. Посмотреть изменения апстрима: `git -C ~/.earshot/src fetch && git -C ~/.earshot/src log --oneline HEAD..origin/main`.
2. Поменять `SHA` в `scripts/install.sh`, выпустить новую версию плагина.
3. На машинах: `/plugin marketplace update alisov-tools`, затем `/earshot:setup`.
