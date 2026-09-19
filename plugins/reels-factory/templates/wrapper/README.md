# Обёртка Claude Code для n8n

## Установка на сервере

```bash
mkdir -p /srv/reels/{jobs,plugin}
chown -R reels:reels /srv/reels
chmod 700 /srv/reels/jobs

npm i -g @anthropic-ai/claude-code
cd /srv/reels/wrapper && npm i express

# ключи — в окружении процесса, не в файле рядом с кодом
pm2 start server.js --name edl-wrapper \
  --env ANTHROPIC_API_KEY=... --env EDL_TOKEN=... --env JOBS_DIR=/srv/reels/jobs
```

Обёртка слушает **только 127.0.0.1** — наружу не публикуется, в nginx не проксируется.
n8n на том же хосте ходит на неё напрямую.

## Нода в n8n

HTTP Request:
- URL `http://127.0.0.1:3230/edl`
- Method POST
- Header `Authorization: Bearer {{$env.EDL_TOKEN}}`
- Body `{ "job": "{{$json.recordId}}", "brief": "{{$json.brief}}" }`
- Timeout 300000

## Почему Claude Code без Bash

Промпт собирается из внешних данных: заголовки рилсов конкурентов, тексты идей,
транскрипт. Любая из этих строк может содержать инструкцию. Дай агенту Bash —
и prompt injection становится исполнением кода на хосте, где живут сайты
и клиентские базы.

Claude пишет JSON. Валидацию, рендер и публикацию делает код, который нельзя переубедить.

## Модель угроз

- Достучаться: только процессы на localhost. Наружу порт не открыт.
- Утечёт конфиг → утечёт `ANTHROPIC_API_KEY`: чужие генерации за твой счёт.
  Ключ отдельный, только под этот процесс, с лимитом расхода в консоли Anthropic.
- Худший случай при компрометации обёртки: запись файлов внутри `/srv/reels/jobs`.
  Папка смонтирована без доступа к `/www` и без прав на исполнение.
- `EDL_TOKEN` в заголовке, не в пути: всё, что в URL, попадает в access.log,
  Referer и историю браузера.
