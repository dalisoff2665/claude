#!/usr/bin/env python3
"""
Тянет библиотеку ассетов из Airtable «DANIEL - CONTENT MASTER» в assets.json.
Это твоё преимущество: у тебя уже есть каталог музыки, SFX, фонов и 898 лого
с готовыми Cloudinary-ссылками. Claude выбирает из каталога по description/keywords,
а не ищет что-то в интернете.

    export AIRTABLE_PAT=...          # PAT только на эту базу, scope data.records:read
    python3 scripts/assets_sync.py

Токен читается из окружения. Никогда не пиши его в файл и не передавай в URL.
"""
import json, os, sys, urllib.parse, urllib.request

BASE = os.environ.get("AIRTABLE_BASE", "appspFv4OyALMTk8K")
PAT = os.environ.get("AIRTABLE_PAT")

TABLES = {
    "music":      ("tblIzJ1OTq96gXpMx", ["Name", "Cloudinary", "Category", "Active", "mood", "description"]),
    "backgrounds": ("tblrbIazyDKKODuaQ", ["Name", "Cloudinary", "duration", "Favorite"]),
    "logos":      ("tblQ8rPqrVdl0xxfB", ["Name", "Cloudinary", "keywords", "filename", "Favorite"]),
}

def fetch(table_id, fields):
    rows, offset = [], None
    while True:
        q = [("pageSize", "100")] + [("fields[]", f) for f in fields]
        if offset:
            q.append(("offset", offset))
        url = f"https://api.airtable.com/v0/{BASE}/{table_id}?" + urllib.parse.urlencode(q)
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {PAT}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        rows += [{"id": rec["id"], **rec.get("fields", {})} for rec in data.get("records", [])]
        offset = data.get("offset")
        if not offset:
            break
    return rows

def main():
    if not PAT:
        sys.exit("нет AIRTABLE_PAT в окружении")

    out = {}
    for name, (tid, fields) in TABLES.items():
        rows = fetch(tid, fields)
        rows = [r for r in rows if r.get("Cloudinary")]
        out[name] = rows
        print(f"  {name}: {len(rows)}")

    # музыку делим на фон и эффекты — в EDL это разные слои
    music = out.pop("music", [])
    out["sfx"] = [m for m in music if m.get("Category") == "Sound Effect"]
    out["music"] = [m for m in music if m.get("Category") != "Sound Effect"]

    # лого индексируем по ключевым словам, чтобы Claude искал по названию инструмента
    out["logo_index"] = {
        (l.get("filename") or l.get("Name", "")).replace(".svg", "").lower(): l["Cloudinary"]
        for l in out.get("logos", [])
    }

    with open("assets.json", "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\n✓ assets.json · музыка {len(out['music'])} · SFX {len(out['sfx'])} "
          f"· фоны {len(out.get('backgrounds', []))} · лого {len(out.get('logos', []))}")

if __name__ == "__main__":
    main()
