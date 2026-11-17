#!/usr/bin/env python3
"""Сборка длинного видео 16:9 по монтажному плану edit.json.

    python3 assemble.py edit.json --out out/video.mp4          # собрать
    python3 assemble.py edit.json --sheet out/sheet.jpg        # контакт-лист готового видео
    python3 assemble.py edit.json --check                      # только проверить план

Пути в edit.json считаются от папки, где лежит edit.json.
Нужен только ffmpeg/ffprobe. Шоты кэшируются в out/.cache/.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
MOTIONS = {"in", "out", "left", "right", "none"}
GAP_TOLERANCE = 0.05


def die(msg):
    print(f"✗ {msg}", file=sys.stderr)
    sys.exit(1)


def run(cmd):
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        tail = "\n".join(res.stderr.strip().splitlines()[-15:])
        die(f"ffmpeg упал:\n  {' '.join(cmd)}\n{tail}")
    return res.stdout


def duration(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", str(path)])
    try:
        return float(out.strip())
    except ValueError:
        die(f"не удалось прочитать длительность: {path}")


def load_plan(plan_path):
    base = plan_path.parent
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    errors, warnings = [], []

    w, h = plan.get("size", [1920, 1080])
    fps = plan.get("fps", 30)
    plan["size"], plan["fps"] = [int(w), int(h)], int(fps)

    voice = plan.get("voice")
    if not voice:
        errors.append("нет поля voice")
    elif not (base / voice).exists():
        errors.append(f"нет файла голоса: {voice}")

    music = plan.get("music")
    if music and not (base / music.get("src", "")).exists():
        errors.append(f"нет файла музыки: {music.get('src')}")

    subs = plan.get("subtitles")
    if subs and subs.get("burn") and not (base / subs.get("src", "")).exists():
        errors.append(f"нет файла субтитров: {subs.get('src')}")

    shots = plan.get("shots") or []
    if not shots:
        errors.append("нет ни одного шота в shots")
    prev_end = 0.0
    for i, s in enumerate(shots):
        tag = f"шот {i + 1} ({s.get('src')})"
        if not (base / s.get("src", "")).exists():
            errors.append(f"{tag}: файл не найден")
        start, end = float(s.get("start", -1)), float(s.get("end", -1))
        if end <= start:
            errors.append(f"{tag}: end ≤ start")
        if abs(start - prev_end) > GAP_TOLERANCE:
            kind = "дыра" if start > prev_end else "наложение"
            errors.append(f"{tag}: {kind} {abs(start - prev_end):.2f} с после предыдущего (start={start}, ожидалось {prev_end})")
        if s.get("motion", "in") not in MOTIONS:
            errors.append(f"{tag}: motion должен быть одним из {sorted(MOTIONS)}")
        prev_end = end

    if not errors and voice:
        vdur = duration(base / voice)
        if abs(prev_end - vdur) > 0.5:
            warnings.append(f"шоты заканчиваются на {prev_end:.2f} с, голос длится {vdur:.2f} с")
        plan["_voice_duration"] = vdur

    plan["_total"] = prev_end
    return plan, errors, warnings


def shot_key(shot, src, size, fps):
    st = src.stat()
    raw = json.dumps([shot, size, fps, st.st_size, int(st.st_mtime)], sort_keys=True)
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def render_shot(shot, src, dst, size, fps):
    w, h = size
    dur = float(shot["end"]) - float(shot["start"])
    frames = max(1, round(dur * fps))
    enc = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
           "-pix_fmt", "yuv420p", "-r", str(fps)]

    if src.suffix.lower() in IMAGE_EXT:
        motion = shot.get("motion", "in")
        zoom = float(shot.get("zoom", 0.12))
        n = frames
        big_w, big_h = w * 2, h * 2
        if motion == "in":
            z, x, y = f"1+{zoom}*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
        elif motion == "out":
            z, x, y = f"{1 + zoom}-{zoom}*on/{n}", "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
        elif motion == "left":
            z, x, y = f"{1 + zoom}", f"(iw-iw/zoom)*(1-on/{n})", "ih/2-(ih/zoom/2)"
        elif motion == "right":
            z, x, y = f"{1 + zoom}", f"(iw-iw/zoom)*on/{n}", "ih/2-(ih/zoom/2)"
        else:
            z, x, y = "1", "0", "0"
        vf = (f"scale={big_w}:{big_h}:force_original_aspect_ratio=increase,crop={big_w}:{big_h},"
              f"zoompan=z='{z}':x='{x}':y='{y}':d={n}:s={w}x{h}:fps={fps},setsar=1")
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf", vf,
               "-frames:v", str(frames)] + enc + [str(dst)]
    else:
        trim_in = float(shot.get("trim_in", 0))
        vf = (f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
              f"fps={fps},setsar=1")
        cmd = ["ffmpeg", "-y", "-v", "error", "-stream_loop", "-1", "-ss", f"{trim_in:.3f}",
               "-i", str(src), "-vf", vf, "-frames:v", str(frames)] + enc + [str(dst)]
    run(cmd)


def assemble(plan_path, plan, out_path):
    base = plan_path.parent
    size, fps, total = plan["size"], plan["fps"], plan["_total"]
    cache = out_path.parent / ".cache"
    cache.mkdir(parents=True, exist_ok=True)

    parts = []
    for i, shot in enumerate(plan["shots"]):
        src = base / shot["src"]
        part = cache / f"{shot_key(shot, src, size, fps)}.mp4"
        if not part.exists():
            print(f"  шот {i + 1}/{len(plan['shots'])}: {shot['src']}")
            render_shot(shot, src, part, size, fps)
        parts.append(part)

    concat_list = cache / "concat.txt"
    concat_list.write_text("".join(f"file '{p.resolve()}'\n" for p in parts), encoding="utf-8")
    video_only = cache / "video_only.mp4"
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(concat_list),
         "-c", "copy", str(video_only)])

    inputs = ["-i", str(video_only), "-i", str(base / plan["voice"])]
    music = plan.get("music")
    if music:
        inputs += ["-stream_loop", "-1", "-i", str(base / music["src"])]
        vol = float(music.get("volume", 0.18))
        if music.get("duck", True):
            afilter = (f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[v1][v2];"
                       f"[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={vol}[m];"
                       f"[m][v2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];"
                       f"[v1][md]amix=inputs=2:duration=first:normalize=0,"
                       f"loudnorm=I=-14:TP=-1.5:LRA=11[a]")
        else:
            afilter = (f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo[v];"
                       f"[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={vol}[m];"
                       f"[v][m]amix=inputs=2:duration=first:normalize=0,"
                       f"loudnorm=I=-14:TP=-1.5:LRA=11[a]")
    else:
        afilter = "[1:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=11[a]"

    subs = plan.get("subtitles") or {}
    if subs.get("burn"):
        srt = str((base / subs["src"]).resolve()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        style = subs.get("style", "FontName=Inter,FontSize=22,Bold=1,Outline=2,Shadow=0,MarginV=48")
        vfilter = f"[0:v]subtitles='{srt}':force_style='{style}'[v]"
        vmap, venc = "[v]", ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p"]
        fc = vfilter + ";" + afilter
    else:
        vmap, venc, fc = "0:v", ["-c:v", "copy"], afilter

    out_path.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-y", "-v", "error"] + inputs +
        ["-filter_complex", fc, "-map", vmap, "-map", "[a]"] + venc +
        ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{total:.3f}",
         "-movflags", "+faststart", str(out_path)])
    print(f"✓ {out_path}  {duration(out_path):.2f} с, {size[0]}×{size[1]} {fps} fps, −14 LUFS")


def contact_sheet(video, sheet):
    dur = duration(video)
    sheet.parent.mkdir(parents=True, exist_ok=True)
    vf = (f"fps=12/{dur:.3f},scale=480:-2,"
          f"drawtext=text='%{{pts\\:hms}}':x=10:y=10:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6,"
          f"tile=4x3:padding=6:color=black")
    run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vf", vf, "-frames:v", "1", str(sheet)])
    print(f"✓ контакт-лист {sheet} — открой его и посмотри кадры")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--sheet", type=Path)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            die(f"нет {tool}. macOS: brew install ffmpeg · Windows: winget install Gyan.FFmpeg")
    if not args.plan.exists():
        die(f"нет файла {args.plan}")

    plan, errors, warnings = load_plan(args.plan)
    for w in warnings:
        print(f"! {w}")
    if errors:
        die("план с ошибками:\n  " + "\n  ".join(errors))
    print(f"✓ план: {len(plan['shots'])} шотов, {plan['_total']:.2f} с")
    if args.check:
        return

    base = args.plan.parent
    out = args.out or Path(plan.get("out", "out/video.mp4"))
    out = out if out.is_absolute() else (Path.cwd() / out)

    if args.out or not args.sheet:
        assemble(args.plan, plan, out)
    if args.sheet:
        video = out if out.exists() else base / plan.get("out", "out/video.mp4")
        if not video.exists():
            die(f"нет готового видео {video}: сначала соберите его с --out")
        contact_sheet(video, args.sheet)


if __name__ == "__main__":
    main()
