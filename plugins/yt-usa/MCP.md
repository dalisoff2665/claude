# Что поставить в Claude для американского YouTube

Главное — **vidIQ**: внутри больше 70 инструментов — исследования, генерация,
аналитика твоего канала. Остальное — по формату канала.

## 1. vidIQ — обязательно

**Claude Desktop / claude.ai:** Settings → Connectors → Browse → **vidIQ** → Connect →
войти в аккаунт vidIQ.

**Claude Code:**
```bash
claude mcp add --transport http vidiq https://mcp.vidiq.com/mcp
```
Потом в Claude Code: `/mcp` → vidiq → Authenticate.

**Подключить YouTube-канал:** напиши Claude «подключи мой YouTube-канал к vidIQ» —
он вызовет `vidiq_connect_youtube_channel` и даст ссылку на авторизацию Google.
Без этого не работают аналитика, удержание и обновление видео.

**Платный план.** Бесплатный план — 150 кредитов в месяц. Одно 10-минутное видео целиком на vidIQ
стоит около 370 кредитов (раскладка — в скилле `yt-usa`). Для регулярного канала нужен платный план:
https://app.vidiq.com/upgrade/mcp/claude. Текущие цены и объём кредитов — на vidiq.com/plans,
они меняются, поэтому здесь их нет. Подписка Claude не даёт кредитов vidIQ, и наоборот.

**Что vidIQ генерирует:**

| Что | Инструмент | Кредиты |
|---|---|---|
| Превью 16:9 и 9:16, доработка словами | `vidiq_generate_thumbnail`, `vidiq_refine_thumbnail` | 22 |
| Видео-сцены: Seedance 2, MiniMax H3, Wan 3, Gemini Omni | `vidiq_generate_video` | секунды × ставка модели × 20 |
| Стоковый B-roll | `vidiq_generate_broll` | 1 |
| Моушн-графика: цифры, сравнения, титры | `vidiq_motion_graphics` | 1 за 4 с |
| Озвучка, в том числе твоим клоном | `vidiq_voiceover_generate` | 28 за 1000 знаков |
| Музыка без авторских прав | `vidiq_generate_music` | 25 |
| Сборка ролика до 4 минут | `vidiq_compose` | 1 за 4 с |
| Шортс из длинного видео | `vidiq_generate_clips` | 9 за минуту |
| Сценарий, заголовки, главы | `vidiq_generate_script`, `vidiq_generate_titles`, `vidiq_generate_video_chapters` | 1/мин, 5, 5 |

## 2. Генераторы — по формату канала

| Нужно | Что подключить | Без чего можно |
|---|---|---|
| Свой голос по-английски | ElevenLabs (официальный MCP `elevenlabs-mcp`) или HeyGen | без них — голоса vidIQ |
| Перевод своих видео с липсинком, аватар | HeyGen (коннектор в Claude) | если снимаешь сам на английском |
| Картинки: Nano Banana, Seedream, GPT Image | kie.ai через свой MCP или Gemini API | превью делает vidIQ |
| Видео: Veo 3, Kling, Seedance | kie.ai через свой MCP | сцены делает vidIQ |
| Скриншоты сайтов для обзоров | Playwright MCP | снимать руками |
| Разбор чужих роликов массово | Apify | `vidiq_watch_shortform_content`, 10 кредитов |

Локально для монтажа: `ffmpeg` и `pip install faster-whisper`. Проверка всего — `/yt-usa:setup`.

## Модель угроз

**vidIQ получает доступ к YouTube-каналу.** Кроме чтения аналитики он может менять заголовок,
описание, теги, приватность и время публикации (`vidiq_update_video`), ставить превью
(`vidiq_update_video_thumbnail`) и отвечать на комментарии от имени канала (`vidiq_reply_to_comment`).
Худший случай — кто-то с доступом к твоей сессии Claude делает видео приватными
или пишет комментарии от тебя.

Что сделано в пакете: скиллы вызывают запись только после явного подтверждения
точных значений. Что сделать тебе в Claude Code — запретить запись без вопроса
(`~/.claude/settings.json`; если назвал сервер иначе, чем `vidiq`, поменяй префикс):

```json
{
  "permissions": {
    "ask": [
      "mcp__vidiq__vidiq_update_video",
      "mcp__vidiq__vidiq_update_video_thumbnail",
      "mcp__vidiq__vidiq_reply_to_comment",
      "mcp__vidiq__vidiq_instagram_publish_reel"
    ]
  }
}
```

**Кредиты.** Зацикленный агент может сжечь месячный лимит за минуты. В пакете: цена называется
до запуска, задача не перезапускается, при «Not enough credits» вызов не повторяется.

**Ключи генераторов** (ElevenLabs, kie.ai, Gemini) — только в переменных окружения
или `.env` с `chmod 600`, вне git, никогда в чате. Один ключ — один сервис.
Утечка ключа ElevenLabs или HeyGen — это не только деньги, это **твой голос и твоё лицо**
в чужих руках: отдельный ключ, минимальные права, ротация раз в квартал.

**Отозвать доступ** vidIQ к YouTube: myaccount.google.com → Безопасность → Сторонние приложения → vidIQ.
