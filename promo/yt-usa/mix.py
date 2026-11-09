#!/usr/bin/env python3
"""Звук рилса: голос + тихий эмбиент-пэд + мягкие «вжухи» на сменах сцен → итог −14 LUFS.

    python3 mix.py            → out/reel.mp4 (с музыкой) и out/reel_voice_only.mp4
"""
import json
import subprocess
from pathlib import Path

D = Path(__file__).parent
B, O = D / "build", D / "out"
O.mkdir(exist_ok=True)
tl = json.loads((B / "timeline.json").read_text(encoding="utf-8"))
video = B / "reel_video.mp4"
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                     "-of", "csv=p=0", str(video)]).decode().strip())

# смены сцен = первое предложение каждой новой сцены
cuts, prev = [], None
for s in tl["sentences"]:
    if s["scene"] != prev and prev is not None:
        cuts.append(max(0.0, s["start"] - 0.22))
    prev = s["scene"]

A = [110.00, 164.81, 246.94, 261.63, 329.63]   # Am9
F = [87.31, 130.81, 220.00, 261.63, 329.63]    # Fmaj7
amp = [1, .7, .5, .4, .3]
w = "(0.5+0.5*sin(2*PI*t/12.8))"
chord = lambda fr: "+".join(f"{a}*sin(2*PI*{f}*t)" for a, f in zip(amp, fr))
pad = (f"aevalsrc='0.05*({w}*({chord(A)})+(1-{w})*({chord(F)}))*(0.8+0.2*sin(2*PI*0.21*t))'"
       f":s=48000:d={dur:.2f},lowpass=f=1100,aecho=0.8:0.6:70|140:0.25|0.15,"
       f"afade=t=in:d=1.5,afade=t=out:st={dur - 1.6:.2f}:d=1.5,pan=stereo|c0=c0|c1=c0,volume=0.55[pad]")

parts = [pad]
labels = []
for i, c in enumerate(cuts):
    ms = int(c * 1000)
    parts.append(f"anoisesrc=d=0.5:c=pink:a=0.6:r=48000,highpass=f=500,lowpass=f=3500,"
                 f"afade=t=in:d=0.28:curve=exp,afade=t=out:st=0.28:d=0.22,volume=0.16,"
                 f"pan=stereo|c0=c0|c1=c0,adelay={ms}|{ms}[w{i}]")
    labels.append(f"[w{i}]")
parts.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0[wh]")
parts.append("[1:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-2[vo]")
parts.append("[vo][pad][wh]amix=inputs=3:duration=first:normalize=0,"
             f"apad=whole_dur={dur:.2f},loudnorm=I=-14:TP=-1.5:LRA=11[a]")

subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(B / "voice.wav"),
                "-filter_complex", ";".join(parts), "-map", "0:v", "-map", "[a]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", f"{dur:.2f}",
                "-movflags", "+faststart", str(O / "reel.mp4")], check=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(B / "voice.wav"),
                "-filter_complex", f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,"
                                   f"apad=whole_dur={dur:.2f},loudnorm=I=-14:TP=-1.5:LRA=11[a]",
                "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-t", f"{dur:.2f}", "-movflags", "+faststart", str(O / "reel_voice_only.mp4")], check=True)
print("✓", O / "reel.mp4", "и", O / "reel_voice_only.mp4", f"{dur:.2f} с,", len(cuts), "смен сцен")
