#!/usr/bin/env python3
"""Рендер ролика: SVG-кадры -> PNG -> ffmpeg -> mp4 с вшитыми субтитрами.

Два режима:
  standalone           — плотный фон, карточки на весь кадр (по умолчанию)
  --footage <file>     — карточки накладываются поверх говорящей головы
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reelkit  # noqa: E402
import validate as validator  # noqa: E402


def run(cmd, **kw):
    """Всегда списком аргументов — никакого shell=True в пайплайне."""
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw)


def build_frames(timeline, spec, preset, logos, workdir, overlay):
    W, H = preset["canvas"]["width"], preset["canvas"]["height"]
    step_total = sum(1 for e in timeline if e["type"] == "step")
    pngs, step_no = [], 0

    for e in timeline:
        if e["type"] == "step":
            step_no += 1
        svg_path = workdir / f"shot_{e['index']:03d}.svg"
        png_path = workdir / f"shot_{e['index']:03d}.png"
        svg_path.write_text(
            reelkit.build_shot_svg(e, spec, preset, logos, step_no, step_total, overlay=overlay),
            encoding="utf-8",
        )
        run(["rsvg-convert", "-w", str(W), "-h", str(H), str(svg_path), "-o", str(png_path)])
        pngs.append(png_path)

    return pngs


def ffmpeg_cmd(pngs, timeline, preset, workdir, out_path, audio, footage):
    fps = preset["canvas"]["fps"]
    W, H = preset["canvas"]["width"], preset["canvas"]["height"]
    enc = preset["encode"]
    total = sum(e["frames"] for e in timeline)
    n = len(pngs)

    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for e, png in zip(timeline, pngs):
        cmd += ["-loop", "1", "-framerate", str(fps),
                "-t", f"{e['frames']/fps + 0.5:.3f}", "-i", png.name]

    idx = n
    footage_idx = audio_idx = None
    if footage:
        cmd += ["-stream_loop", "-1", "-i", str(Path(footage).resolve())]
        footage_idx = idx
        idx += 1
    if audio:
        cmd += ["-i", str(Path(audio).resolve())]
        audio_idx = idx
        idx += 1
    elif enc.get("silent_track_if_no_audio"):
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        audio_idx = idx
        idx += 1

    chains = []
    for i, e in enumerate(timeline):
        chains.append(
            f"[{i}:v]scale={W}:{H},setsar=1,format=rgba,"
            f"trim=end_frame={e['frames']},setpts=PTS-STARTPTS[v{i}]"
        )

    if footage:
        chains.append(
            f"[{footage_idx}:v]fps={fps},scale={W}:{H}:force_original_aspect_ratio=increase,"
            f"crop={W}:{H},setsar=1,format=rgba,trim=end_frame={total},setpts=PTS-STARTPTS[bg]"
        )
        prev = "bg"
        for i, e in enumerate(timeline):
            lo, hi = e["start_frame"], e["start_frame"] + e["frames"] - 1
            tag = "cat" if i == len(timeline) - 1 else f"o{i}"
            chains.append(f"[{prev}][v{i}]overlay=enable='between(n\\,{lo}\\,{hi})'[{tag}]")
            prev = tag
    else:
        chains.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[cat]")

    chains.append(f"[cat]ass=subs.ass,format={enc['pix_fmt']}[vout]")

    cmd += ["-filter_complex", ";".join(chains), "-map", "[vout]"]
    if audio_idx is not None:
        cmd += ["-map", f"{audio_idx}:a", "-c:a", enc["acodec"], "-b:a", enc["abitrate"],
                "-ac", "2", "-ar", "48000", "-shortest"]
    cmd += ["-c:v", enc["vcodec"], "-crf", str(enc["crf"]), "-preset", enc["preset"],
            "-r", str(fps), "-movflags", "+faststart", str(Path(out_path).resolve())]
    return cmd


def main():
    ap = argparse.ArgumentParser(description="Рендер ролика")
    ap.add_argument("spec")
    ap.add_argument("--out", default=None)
    ap.add_argument("--audio", default=None, help="дорожка озвучки (wav/mp3/m4a)")
    ap.add_argument("--footage", default=None, help="видео говорящей головы — карточки лягут поверх")
    ap.add_argument("--keep", action="store_true", help="не удалять промежуточные кадры")
    args = ap.parse_args()

    spec = reelkit.load_spec(args.spec)
    preset = reelkit.load_preset(spec["preset"])
    logos = reelkit.load_logo_index()

    errors, warns, _ = validator.check(spec, preset, logos)
    for w in warns:
        print(f"  WARN  {w}")
    if errors:
        for e in errors:
            print(f"  ERROR {e}")
        print("\nрендер отменён — сначала почини спеку (validate.py)")
        return 1

    timeline, total = reelkit.build_timeline(spec, preset)
    out_path = Path(args.out) if args.out else reelkit.ROOT / "out" / f"{spec['id']}.mp4"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    workdir = reelkit.ROOT.parent / "build" / f"_{spec['id']}_frames"
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.mkdir(parents=True)

    print(f"кадры   : {len(timeline)} планов x {timeline[0]['frames']} кадров = {total}")
    build_frames(timeline, spec, preset, logos, workdir, overlay=bool(args.footage))

    (workdir / "subs.ass").write_text(reelkit.build_ass(timeline, spec, preset), encoding="utf-8")
    n_words = sum(len(e["words"]) for e in timeline)
    print(f"субтитры: {n_words} слов, по одному в кадре")

    cmd = ffmpeg_cmd(list(workdir.glob("shot_*.png")) and
                     sorted(workdir.glob("shot_*.png")),
                     timeline, preset, workdir, out_path, args.audio, args.footage)
    print(f"режим   : {'overlay поверх футажа' if args.footage else 'standalone'}")
    try:
        run(cmd, cwd=workdir)
    except subprocess.CalledProcessError as exc:
        print("\nffmpeg упал:\n" + (exc.stderr or "")[-2500:])
        return 1

    probe = json.loads(run([
        "ffprobe", "-v", "error", "-show_streams", "-show_format",
        "-of", "json", str(out_path)
    ]).stdout)
    v = next(s for s in probe["streams"] if s["codec_type"] == "video")
    print(f"\nготово  : {out_path}")
    print(f"          {v['width']}x{v['height']} @ {v['r_frame_rate']} | "
          f"{v['nb_frames']} кадров | {float(probe['format']['duration']):.3f}с | "
          f"{int(probe['format']['size'])/1024:.0f} KB")

    if not args.keep:
        shutil.rmtree(workdir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
