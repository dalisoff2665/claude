# Первая заливка — один раз

```bash
cd ~/Downloads/reels-marketplace

git init
git add -A
git commit -m "1.1.0 — пять пресетов монтажа"

git remote add origin git@github.com:dalisoff2665/claude.git
git branch -M main
git push -u origin main
git tag v1.1.0 && git push --tags
```

Если репозиторий не пустой — сначала `git pull --rebase origin main`.

## Подключить на всех машинах

```
/plugin marketplace add dalisoff2665/claude
/plugin install reels-factory@alisov-tools
```

Локальный маркетплейс из папки после этого можно убрать:
`/plugin marketplace remove` — иначе будут две копии и непонятно, какая активна.

## Как это работает дальше

Я даю изменённые файлы. Ты кладёшь их на место и:

```bash
cd ~/Downloads/reels-marketplace
./release.sh 1.1.1 "добавил пресет X"
```

На Mac, на сервере, в любой сессии:

```
/plugin marketplace update alisov-tools
```

Zip больше не нужен.

## Что НЕ должно попасть в репозиторий

`.gitignore` уже закрывает `.env`, `raw/`, `out/`, `jobs/`, `node_modules/`.

Проверь перед первым пушем:

```bash
git status --porcelain | grep -iE '\.env|token|secret|key' || echo "чисто"
```

Репозиторий публичный. Один закоммиченный ключ — и его подхватят боты,
которые сканируют GitHub на свежие секреты. Это происходит за минуты, не за дни.

Если репо приватный — всё равно проверь: приватность меняется одним кликом,
а история остаётся.
