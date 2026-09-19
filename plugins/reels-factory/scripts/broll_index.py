#!/usr/bin/env python3
"""
Раскадровывает каждый демо-скринкаст, чтобы ты мог ПОСМОТРЕТЬ его перед выбором кусков.

    python3 scripts/broll_index.py raw/demo/

Отдаёт broll.json + broll_sheets/<name>.jpg на каждое видео.
Дальше ты читаешь контакт-шиты глазами, дописываешь в broll.json поле "moments"
(человеческое описание: "20-26с — появляется результат генерации, крупно") и только
потом выбираешь отрезки в EDL.

Никогда не вставляй в EDL B-roll, контакт-шит которого ты не открыл.
"""
import argparse, json, subprocess
from pathlib import Path

def sh(c):
    return subprocess.run(c, shell=True, capture_output=True, text=True)

def probe(p):
    r = sh(f'ffprobe -v error -show_entries format=duration -of csv=p=0 "{p}"')
    try:
        return round(float(r.stdout.strip()), 2)
    except ValueError:
        return 0.0

def sheet(src, dst, dur, cols=6, rows=4):
    step = max(1, round(dur / (cols * rows)))
    vf = (f"fps=1/{step},scale=240:-1,"
          f"drawtext=text='%{{pts\\:hms}}':fontsize=16:fontcolor=yellow:x=4:y=4:"
          f"box=1:boxcolor=black@0.6,tile={cols}x{rows}")
    sh(f'ffmpeg -hide_banner -loglevel error -y -i "{src}" -vf "{vf}" -frames:v 1 "{dst}"')
    return step

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--out", default="broll.json")
    ap.add_argument("--sheets", default="broll_sheets")
    a = ap.parse_args()

    src = Path(a.folder)
    sheets = Path(a.sheets); sheets.mkdir(parents=True, exist_ok=True)
    items = []

    for f in sorted(src.glob("*")):
        if f.suffix.lower() not in (".mp4", ".mov", ".webm", ".mkv"):
            continue
        dur = probe(f)
        if dur == 0:
            continue
        out = sheets / f"{f.stem}.jpg"
        step = sheet(f, out, dur)
        items.append({
            "file": str(f),
            "duration": dur,
            "contact_sheet": str(out),
            "sheet_step_sec": step,
            "moments": [],   # ← заполняешь ты, посмотрев контакт-шит
        })
        print(f"  {f.name}: {dur}s → {out}")

    Path(a.out).write_text(json.dumps({"clips": items}, ensure_ascii=False, indent=2))
    print(f"\n✓ {a.out} ({len(items)} клипов)")
    print("  Теперь открой контакт-шиты и заполни \"moments\" в broll.json.")

if __name__ == "__main__":
    main()
