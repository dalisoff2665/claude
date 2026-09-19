#!/usr/bin/env python3
"""
Разбирает чужой Reel/Short на монтажный рецепт.

    python3 scripts/ref_analyze.py https://instagram.com/reel/XXXX --out ref/xxxx/
    python3 scripts/ref_analyze.py локальный.mp4 --out ref/local/

Отдаёт:
    ref/<name>/source.mp4      скачанное видео
    ref/<name>/cuts.json       таймкоды склеек + длины планов + статистика ритма
    ref/<name>/grid.jpg        контакт-шит с таймкодами (читай его глазами)
    ref/<name>/REPORT.md       сводка, которую ты кладёшь в контекст перед написанием EDL
"""
import argparse, json, os, re, shutil, subprocess, sys, statistics
from pathlib import Path

def sh(cmd, **kw):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)

def need(binary):
    if not shutil.which(binary):
        sys.exit(f"нет {binary}. macOS: brew install {binary}")

def download(src, out_dir):
    if os.path.exists(src):
        dst = out_dir / "source.mp4"
        shutil.copy(src, dst)
        return dst
    need("yt-dlp")
    dst = out_dir / "source.mp4"
    r = sh(f'yt-dlp -f "best[ext=mp4]/best" -o "{dst}" "{src}"')
    if not dst.exists():
        sys.exit(f"не скачалось:\n{r.stderr[-800:]}")
    return dst

def probe(path):
    r = sh(f'ffprobe -v error -show_entries format=duration '
           f'-show_entries stream=codec_type,width,height,r_frame_rate '
           f'-of json "{path}"')
    d = json.loads(r.stdout)
    v = next(s for s in d["streams"] if s["codec_type"] == "video")
    num, den = v["r_frame_rate"].split("/")
    return {
        "duration": round(float(d["format"]["duration"]), 3),
        "width": v["width"], "height": v["height"],
        "fps": round(int(num) / int(den), 2),
    }

def detect_cuts(path, threshold):
    r = sh(f'ffmpeg -hide_banner -i "{path}" '
           f'-filter:v "select=\'gt(scene,{threshold})\',showinfo" -f null - 2>&1')
    times = [float(t) for t in re.findall(r"pts_time:([0-9.]+)", r.stdout + r.stderr)]
    # дубли в пределах 0.15с — это один переход (кроссфейд), схлопываем
    merged = []
    for t in sorted(times):
        if not merged or t - merged[-1] > 0.15:
            merged.append(round(t, 3))
    return merged

def loudness(path):
    r = sh(f'ffmpeg -hide_banner -i "{path}" -af ebur128=peak=true -f null - 2>&1')
    m = re.search(r"I:\s+(-?[0-9.]+) LUFS", r.stdout + r.stderr)
    return float(m.group(1)) if m else None

def contact_sheet(path, out, duration, cols=5, rows=5):
    step = max(1, round(duration / (cols * rows)))
    vf = (f"fps=1/{step},scale=270:-1,"
          f"drawtext=text='%{{pts\\:hms}}':fontsize=18:fontcolor=yellow:x=5:y=5:"
          f"box=1:boxcolor=black@0.5,tile={cols}x{rows}")
    sh(f'ffmpeg -hide_banner -loglevel error -y -i "{path}" -vf "{vf}" -frames:v 1 "{out}"')
    return step

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("--out", default="ref/analysis")
    ap.add_argument("--threshold", type=float, default=0.08,
                    help="чувствительность детекции склеек (0.08 ловит перебивки, 0.3 только крупные)")
    a = ap.parse_args()

    need("ffmpeg"); need("ffprobe")
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)

    print("→ качаю")
    video = download(a.source, out)
    meta = probe(video)
    print(f"  {meta['duration']}s  {meta['width']}x{meta['height']}  {meta['fps']}fps")

    print("→ ищу склейки")
    cuts = detect_cuts(video, a.threshold)
    marks = [0.0] + cuts + [meta["duration"]]
    shots = [round(marks[i + 1] - marks[i], 2) for i in range(len(marks) - 1)]
    shots = [s for s in shots if s > 0.2]

    print("→ раскадровка")
    step = contact_sheet(video, out / "grid.jpg", meta["duration"])

    print("→ громкость")
    lufs = loudness(video)

    stats = {
        "source": a.source,
        **meta,
        "cut_count": len(cuts),
        "cuts": cuts,
        "shot_lengths": shots,
        "avg_shot_len": round(statistics.mean(shots), 2) if shots else None,
        "median_shot_len": round(statistics.median(shots), 2) if shots else None,
        "longest_shot": max(shots) if shots else None,
        "cuts_per_10s": round(len(cuts) / meta["duration"] * 10, 1),
        "integrated_lufs": lufs,
        "contact_sheet_step_sec": step,
    }
    (out / "cuts.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2))

    report = f"""# Разбор референса

**Источник:** {a.source}
**Длина:** {meta['duration']} с · {meta['width']}x{meta['height']} · {meta['fps']} fps
**Громкость:** {lufs} LUFS интегрально

## Ритм
- склеек: **{len(cuts)}** ({stats['cuts_per_10s']} на 10 секунд)
- средний план: **{stats['avg_shot_len']} с**, медиана {stats['median_shot_len']} с
- самый длинный план: **{stats['longest_shot']} с** ← потолок статики

## Склейки
{', '.join(f'{c}' for c in cuts)}

## Длины планов
{', '.join(str(s) for s in shots)}

## Дальше
Открой `grid.jpg` и проставь напротив каждой склейки тип плана:
A-roll / слайд / B-roll / PiP / чип. Это и есть рецепт — копируешь структуру, а не содержание.
"""
    (out / "REPORT.md").write_text(report)
    print(f"\n✓ {out}/REPORT.md  ·  {out}/grid.jpg  ·  {out}/cuts.json")
    print(f"  средний план {stats['avg_shot_len']}с, {stats['cuts_per_10s']} склеек на 10с")

if __name__ == "__main__":
    main()
