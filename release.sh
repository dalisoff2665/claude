#!/usr/bin/env bash
# Выпустить новую версию плагина.
#   ./release.sh 1.1.1 "что изменилось"
set -euo pipefail
V="${1:?версия, например 1.1.1}"
MSG="${2:-обновление}"

python3 - "$V" <<'PY'
import json, sys, pathlib
v = sys.argv[1]
for f in [".claude-plugin/marketplace.json", "plugins/reels-factory/.claude-plugin/plugin.json"]:
    p = pathlib.Path(f); d = json.loads(p.read_text())
    if "plugins" in d: d["plugins"][0]["version"] = v
    else: d["version"] = v
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2))
print(f"версия {v}")
PY

git add -A
git commit -m "$V — $MSG"
git tag "v$V"
git push origin main --tags
echo
echo "✓ выпущено. На любой машине:"
echo "  /plugin marketplace update alisov-tools"
