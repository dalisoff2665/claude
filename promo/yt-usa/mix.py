#!/usr/bin/env python3
"""Звук рилса: голос + тихий эмбиент-пэд + звуки на акцентах из build/sfx.json → −14 LUFS.

    python3 mix.py            → out/reel.mp4 (с музыкой и звуками) и out/reel_voice_only.mp4

build/sfx.json пишет render.cjs: [{t, type}], type = whoosh | pop | click | tick | hit | strike | riser.
"""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

D = Path(__file__).parent
B, O = D / "build", D / "out"
O.mkdir(exist_ok=True)
SR = 48000
video = B / "reel_video.mp4"
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                     "-of", "csv=p=0", str(video)]).decode().strip())
N = int(dur * SR)
rng = np.random.default_rng(7)


def env(n, a=0.004, r=None):
    e = np.ones(n)
    k = max(1, int(a * SR))
    e[:k] = np.linspace(0, 1, k)
    if r:
        e *= np.exp(-np.arange(n) / SR * r)
    return e


def lowpass(x, cut):
    a = np.exp(-2 * np.pi * cut / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def sound(kind):
    t = lambda d: np.arange(int(d * SR)) / SR  # noqa: E731
    if kind == "whoosh":
        x = t(0.5)
        noise = rng.standard_normal(len(x))
        bp = lowpass(noise, 3800) - lowpass(noise, 450)
        shape = np.sin(np.pi * np.clip(x / 0.5, 0, 1)) ** 1.6
        return 0.55 * bp * shape
    if kind == "pop":
        x = t(0.09)
        return 0.2 * np.sin(2 * np.pi * (720 + 900 * np.exp(-x * 40)) * x) * env(len(x), r=38)
    if kind == "click":
        x = t(0.05)
        return 0.38 * (np.sin(2 * np.pi * 2300 * x) + 0.4 * rng.standard_normal(len(x))) * env(len(x), 0.001, 95)
    if kind == "tick":
        x = t(0.06)
        return 0.22 * np.sin(2 * np.pi * 1650 * x) * env(len(x), 0.001, 70)
    if kind == "hit":
        x = t(0.6)
        boom = np.sin(2 * np.pi * (52 + 70 * np.exp(-x * 9)) * x) * env(len(x), 0.002, 6.5)
        snap = lowpass(rng.standard_normal(len(x)), 2500) * env(len(x), 0.001, 30)
        return 0.75 * boom + 0.35 * snap
    if kind == "strike":
        x = t(0.2)
        n = rng.standard_normal(len(x)) - lowpass(rng.standard_normal(len(x)), 1500)
        return 0.22 * n * np.sin(np.pi * x / 0.2)
    if kind == "riser":
        x = t(0.9)
        f = 180 + 700 * (x / 0.9) ** 2
        return 0.13 * np.sin(2 * np.pi * np.cumsum(f) / SR) * (x / 0.9) ** 1.5
    return np.zeros(1)


bank = {k: sound(k) for k in ["whoosh", "pop", "click", "tick", "hit", "strike", "riser"]}
fx = np.zeros(N + SR)
events = json.loads((B / "sfx.json").read_text()) if (B / "sfx.json").exists() else []
last, kept = {}, []
for e in sorted(events, key=lambda e: e["t"]):  # не чаще одного звука одного типа за 0.14 с
    if e["t"] - last.get(e["type"], -9) >= 0.14:
        kept.append(e)
        last[e["type"]] = e["t"]
events = kept
for e in events:
    s = bank.get(e["type"])
    i = int(max(0, e["t"]) * SR)
    if s is None or i >= N:
        continue
    fx[i:i + len(s)] += s[: len(fx) - i]

# пэд: Am9 ↔ Fmaj7, медленное дыхание
x = np.arange(N) / SR
A = [110.00, 164.81, 246.94, 261.63, 329.63]
F = [87.31, 130.81, 220.00, 261.63, 329.63]
amp = [1, .7, .5, .4, .3]
w = 0.5 + 0.5 * np.sin(2 * np.pi * x / 12.8)
pad = sum(a * (w * np.sin(2 * np.pi * fa * x) + (1 - w) * np.sin(2 * np.pi * ff * x)) for a, fa, ff in zip(amp, A, F))
pad *= 0.022 * (0.8 + 0.2 * np.sin(2 * np.pi * 0.21 * x))
fade = np.clip(x / 1.2, 0, 1) * np.clip((dur - x) / 1.5, 0, 1)
bed = pad * fade + fx[:N]
bed = np.clip(bed, -1, 1)
with wave.open(str(B / "bed.wav"), "wb") as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(SR)
    f.writeframes((bed * 32767).astype("<i2").tobytes())

# голос громче всего, кровать под ним приглушается
fc = ("[1:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-2,asplit=2[vo][sc];"
      "[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.0[bd];"
      "[bd][sc]sidechaincompress=threshold=0.05:ratio=3:attack=15:release=250[bdd];"
      f"[vo][bdd]amix=inputs=2:duration=longest:normalize=0,apad=whole_dur={dur:.2f},"
      "loudnorm=I=-14:TP=-1.5:LRA=11[a]")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(B / "voice.wav"), "-i", str(B / "bed.wav"),
                "-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-t", f"{dur:.2f}", "-movflags", "+faststart", str(O / "reel.mp4")], check=True)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-i", str(B / "voice.wav"),
                "-filter_complex", f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur={dur:.2f},"
                                   "loudnorm=I=-14:TP=-1.5:LRA=11[a]",
                "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                "-t", f"{dur:.2f}", "-movflags", "+faststart", str(O / "reel_voice_only.mp4")], check=True)
print("✓", O / "reel.mp4", "и", O / "reel_voice_only.mp4", f"{dur:.2f} с,", len(events), "звуков")
