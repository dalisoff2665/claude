#!/usr/bin/env python3
"""
Кузница звуковых эффектов. Собирает СЛОИСТЫЕ SFX кинематографического толка
и кладёт их в Cloudinary + таблицу music.

    export ELEVENLABS_API_KEY=...
    python3 sfx_forge.py --recipe whoosh_heavy
    python3 sfx_forge.py --all            # весь набор рецептов

Почему слои. Один сгенерированный звук всегда звучит плоско. Кинематографический
эффект — это три слоя, разнесённые по спектру и по времени:

    transient  0–60 мс     щелчок, верх          режется хайпассом
    body       60–500 мс   основное тело, середина
    tail       200–1500 мс хвост и саб           лоупасс + задержка

Замер эталона (моушн-рилс sultanmotions):
    саб −24.1 · низ −20.7 · середина −21.2 · верх −30.8 · воздух −38.6 dB
Энергия в нижней середине, верх на 10 dB тише. Дешёвый SFX звучит наоборот.
"""
import argparse, json, os, subprocess, sys, tempfile, urllib.request
from pathlib import Path

KEY = os.environ.get("ELEVENLABS_API_KEY")
API = "https://api.elevenlabs.io/v1/sound-generation"

# рецепты: три слоя на эффект, каждый со своей ролью в спектре
RECIPES = {
    "whoosh_heavy": {
        "desc": "переход между сценами, тяжёлый",
        "layers": [
            {"role": "transient", "prompt": "sharp short air click, dry, no reverb", "dur": 0.4,
             "filter": "highpass=f=3000,volume=-6dB"},
            {"role": "body", "prompt": "deep cinematic whoosh passing by, dense mid frequencies", "dur": 1.2,
             "filter": "bandpass=f=700:width_type=o:w=2.5"},
            {"role": "tail", "prompt": "low sub rumble decay, dark", "dur": 1.8,
             "filter": "lowpass=f=180,adelay=90|90,volume=-3dB"},
        ],
    },
    "impact_soft": {
        "desc": "появление элемента, мягкий удар",
        "layers": [
            {"role": "transient", "prompt": "soft wooden tap, dry, close mic", "dur": 0.3,
             "filter": "highpass=f=1800,volume=-8dB"},
            {"role": "body", "prompt": "muted cinematic impact, warm, no metallic ring", "dur": 0.9,
             "filter": "bandpass=f=400:width_type=o:w=3"},
            {"role": "tail", "prompt": "short sub drop, soft decay", "dur": 1.2,
             "filter": "lowpass=f=140,adelay=60|60,volume=-5dB"},
        ],
    },
    "ui_pop": {
        "desc": "появление чипа или бейджа",
        "layers": [
            {"role": "transient", "prompt": "tiny crisp UI click, clean", "dur": 0.25,
             "filter": "highpass=f=2500,volume=-10dB"},
            {"role": "body", "prompt": "soft bubble pop, warm plastic", "dur": 0.5,
             "filter": "bandpass=f=900:width_type=o:w=2"},
        ],
    },
    "riser_short": {
        "desc": "нагнетание перед сменой главы",
        "layers": [
            {"role": "body", "prompt": "short tension riser building up, cinematic, 1.5 seconds", "dur": 2.0,
             "filter": "bandpass=f=1200:width_type=o:w=3,volume=-4dB"},
            {"role": "tail", "prompt": "deep sub swell rising", "dur": 2.2,
             "filter": "lowpass=f=200,volume=-2dB"},
        ],
    },
    "data_glitch": {
        "desc": "цифровой сбой, слом ожидания",
        "layers": [
            {"role": "transient", "prompt": "digital glitch burst, short, granular", "dur": 0.4,
             "filter": "highpass=f=2000,volume=-9dB"},
            {"role": "body", "prompt": "distorted data corruption texture, dense", "dur": 0.8,
             "filter": "bandpass=f=600:width_type=o:w=3"},
            {"role": "tail", "prompt": "low electrical hum decay", "dur": 1.2,
             "filter": "lowpass=f=160,adelay=70|70,volume=-6dB"},
        ],
    },
}


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)


def generate(prompt, seconds, out):
    req = urllib.request.Request(
        API,
        data=json.dumps({
            "text": prompt,
            "duration_seconds": max(0.5, min(22, seconds)),
            "prompt_influence": 0.6,
        }).encode(),
        headers={"xi-api-key": KEY, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r, open(out, "wb") as f:
        f.write(r.read())


def forge(name, recipe, outdir):
    tmp = Path(tempfile.mkdtemp())
    parts = []
    for i, layer in enumerate(recipe["layers"]):
        raw = tmp / f"{i}_raw.mp3"
        print(f"  → {layer['role']}: {layer['prompt'][:52]}…")
        generate(layer["prompt"], layer["dur"], raw)
        proc = tmp / f"{i}.wav"
        sh(f'ffmpeg -hide_banner -loglevel error -y -i "{raw}" -af "{layer["filter"]}" "{proc}"')
        parts.append(proc)

    out = Path(outdir) / f"{name}.mp3"
    out.parent.mkdir(parents=True, exist_ok=True)
    inputs = " ".join(f'-i "{p}"' for p in parts)
    n = len(parts)
    # amix + лёгкая компрессия, чтобы слои склеились в один звук
    sh(f'ffmpeg -hide_banner -loglevel error -y {inputs} '
       f'-filter_complex "amix=inputs={n}:duration=longest:dropout_transition=0,'
       f'acompressor=threshold=-18dB:ratio=3:attack=2:release=120,'
       f'loudnorm=I=-18:TP=-1.5" -b:a 192k "{out}"')

    if out.exists():
        # проверяем, что спектр лёг как надо
        bands = {}
        for label, lo, hi in [("саб", 20, 120), ("низ", 120, 400),
                              ("сер", 400, 2000), ("верх", 2000, 8000)]:
            r = sh(f'ffmpeg -hide_banner -i "{out}" -af '
                   f'"highpass=f={lo},lowpass=f={hi},volumedetect" -f null - 2>&1')
            m = [x for x in (r.stdout + r.stderr).split("\n") if "mean_volume" in x]
            bands[label] = m[0].split(":")[-1].strip() if m else "?"
        print(f"  ✓ {out.name} · " + " · ".join(f"{k} {v}" for k, v in bands.items()))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--recipe", choices=list(RECIPES))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", default="sfx")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    if a.list:
        for k, v in RECIPES.items():
            print(f"  {k:16} {v['desc']} · слоёв {len(v['layers'])}")
        return
    if not KEY:
        sys.exit("нет ELEVENLABS_API_KEY")

    names = list(RECIPES) if a.all else [a.recipe] if a.recipe else []
    if not names:
        sys.exit("укажи --recipe или --all, список: --list")

    for n in names:
        print(f"\n{n} — {RECIPES[n]['desc']}")
        forge(n, RECIPES[n], a.out)

    print(f"\nГотово в {a.out}/. Дальше: залей в Cloudinary и добавь в таблицу music "
          f"с Category = Sound Effect и описанием, когда применять.")


if __name__ == "__main__":
    main()
