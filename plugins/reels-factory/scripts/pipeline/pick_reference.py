#!/usr/bin/env python3
"""
Шаг 1 конвейера. Берёт следующий неиспользованный референс и сразу помечает его
использованным — ставит связь с новой записью CONTENT PLAN.

    python3 pick_reference.py --out job.json

Детерминированно, без ИИ. Именно эта связь закрывает вопрос «брал / не брал»:
после неё референс больше никогда не попадёт в выборку.
"""
import argparse, json, os, sys, urllib.parse, urllib.request

BASE = os.environ.get("AIRTABLE_BASE", "appspFv4OyALMTk8K")
PAT = os.environ.get("AIRTABLE_PAT")
T_REF = "tblz3P9bweAdvw0PY"   # Конкуренты - Анализ
T_PLAN = "tblSppKHHKEDnyIoN"  # CONTENT PLAN
T_IDEA = "tbl1biymk3j7sBpBD"  # Идей постов и публикаций

FORMULA = ("AND({SCORE} >= 8, {decision} = 'ACCEPT', "
           "COUNTA({CONTENT PLAN}) = 0, "
           "DATETIME_DIFF(TODAY(), {Дата}, 'days') < 120)")

def api(method, path, payload=None, query=None):
    url = f"https://api.airtable.com/v0/{BASE}/{path}"
    if query:
        url += "?" + urllib.parse.urlencode(query, doseq=True)
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {PAT}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="job.json")
    ap.add_argument("--preset", default="scene",
                    help="slides | yapping | split | scene")
    a = ap.parse_args()
    if not PAT:
        sys.exit("нет AIRTABLE_PAT")

    refs = api("GET", T_REF, query=[
        ("filterByFormula", FORMULA), ("maxRecords", "1"),
        ("sort[0][field]", "SCORE"), ("sort[0][direction]", "desc"),
        ("sort[1][field]", "videoPlayCount"), ("sort[1][direction]", "desc"),
    ]).get("records", [])
    if not refs:
        print("очередь пуста — нет неиспользованных референсов")
        sys.exit(3)

    ref = refs[0]
    f = ref["fields"]

    ideas = api("GET", T_IDEA, query=[("maxRecords", "1"),
                                      ("sort[0][field]", "Date"),
                                      ("sort[0][direction]", "desc")]).get("records", [])
    idea = ideas[0] if ideas else None

    # что уже выходило — чтобы не повторяться по теме
    recent = api("GET", T_PLAN, query=[
        ("maxRecords", "30"), ("fields[]", "Тема - О чем?"),
        ("sort[0][field]", "time"), ("sort[0][direction]", "desc"),
    ]).get("records", [])

    created = api("POST", T_PLAN, {"records": [{"fields": {
        "Тема - О чем?": f.get("mainTopic") or f.get("Title", ""),
        "СТАТУС СОЗДАНИЕ": "Сценарий готов",
        "Конкуренты - Анализ": [ref["id"]],   # ← отметка «взяли»
        "Референсы": f.get("Reels", ""),
    }}]})["records"][0]

    job = {
        "plan_record": created["id"],
        "ref_record": ref["id"],
        "preset": a.preset,
        "reference": {
            "url": f.get("Reels"), "username": f.get("username"),
            "title": f.get("Title"), "format": f.get("Format"),
            "hook": f.get("hook"), "strengths": f.get("strengths"),
            "adaptation": f.get("adaptationNeeded"),
            "views": f.get("videoPlayCount"),
        },
        "idea": (idea or {}).get("fields", {}).get("Text idea"),
        "recent_topics": [r["fields"].get("Тема - О чем?", "") for r in recent],
    }
    with open(a.out, "w") as fh:
        json.dump(job, fh, ensure_ascii=False, indent=2)
    print(f"✓ {created['id']} · референс @{f.get('username')} "
          f"({f.get('videoPlayCount')} просмотров) помечен использованным")

if __name__ == "__main__":
    main()
