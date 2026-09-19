#!/usr/bin/env python3
"""
Приводит существующие SFX к киношному спектральному профилю и заливает обратно.

    python3 sfx_repair.py --dry           # только замер и диагноз
    python3 sfx_repair.py --fix           # починить локально в sfx/fixed/
    python3 sfx_repair.py --fix --upload  # + Cloudinary + обновить Airtable

Эталон снят с моушн-рилса sultanmotions:
    саб 20-120 −24.1 · низ 120-400 −20.7 · середина 400-2000 −21.2 · верх 2000-8000 −30.8

Дешёвый SFX звучит ярко и тонко: верх громкий, саба нет. Кинематографический —
плотный в нижней середине с весом внизу и приглушённым верхом.

Чинится эквализацией, перегенерация не нужна: сам звук обычно нормальный,
сломан баланс.
"""
import argparse, json, os, subprocess, sys, tempfile, urllib.parse, urllib.request
from pathlib import Path

TARGET = {"sub": -24.1, "low": -20.7, "mid": -21.2, "high": -30.8}
BANDS = {"sub": (20, 120), "low": (120, 400), "mid": (400, 2000), "high": (2000, 8000)}
TOL = 4.0   # допуск в dB, внутри него не трогаем

BASE = os.environ.get("AIRTABLE_BASE", "appspFv4OyALMTk8K")
PAT = os.environ.get("AIRTABLE_PAT")
T_MUSIC = "tblIzJ1OTq96gXpMx"


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)


def measure(path):
    out = {}
    for name, (lo, hi) in BANDS.items():
        r = sh(f'ffmpeg -hide_banner -i "{path}" -af '
               f'"highpass=f={lo},lowpass=f={hi},volumedetect" -f null - 2>&1')
        txt = r.stdout + r.stderr
        val = None
        for line in txt.split("\n"):
            if "mean_volume" in line:
                val = float(line.split("mean_volume:")[1].replace("dB", "").strip())
                break
        out[name] = val
    return out


def diagnose(m):
    """Что не так со звуком, человеческим языком."""
    notes = []
    for band, target in TARGET.items():
        v = m.get(band)
        if v is None:
            continue
        d = v - target
        if abs(d) <= TOL:
            continue
        label = {"sub": "саб", "low": "низ", "mid": "середина", "high": "верх"}[band]
        notes.append(f"{label} {'+' if d > 0 else ''}{d:.1f} dB")
    return notes or ["в профиле"]


def build_eq(m):
    """Корректирующий EQ: тянем каждую полосу к эталону, но не больше 12 dB."""
    parts = []
    centers = {"sub": 60, "low": 250, "mid": 900, "high": 4000}
    widths = {"sub": 1.2, "low": 1.0, "mid": 1.2, "high": 1.4}
    for band, target in TARGET.items():
        v = m.get(band)
        if v is None:
            continue
        d = target - v
        if abs(d) <= TOL:
            continue
        gain = max(-12, min(12, d))
        parts.append(f"equalizer=f={centers[band]}:width_type=o:w={widths[band]}:g={gain:.1f}")
    return ",".join(parts)


def repair(src, dst, m):
    eq = build_eq(m)
    chain = eq + "," if eq else ""
    # компрессия склеивает полосы, loudnorm выравнивает громкость между эффектами
    sh(f'ffmpeg -hide_banner -loglevel error -y -i "{src}" -af '
       f'"{chain}acompressor=threshold=-20dB:ratio=2.5:attack=3:release=140,'
       f'loudnorm=I=-18:TP=-1.5" -b:a 192k "{dst}"')
    return dst


def airtable(method, path, payload=None, query=None):
    url = f"https://api.airtable.com/v0/{BASE}/{path}"
    if query:
        url += "?" + urllib.parse.urlencode(query, doseq=True)
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode() if payload else None, method=method,
        headers={"Authorization": f"Bearer {PAT}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--fix", action="store_true")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--out", default="sfx/fixed")
    a = ap.parse_args()
    if not PAT:
        sys.exit("нет AIRTABLE_PAT")

    rows = airtable("GET", T_MUSIC, query=[
        ("filterByFormula", "{Category}='Sound Effect'"), ("maxRecords", "100"),
    ])["records"]

    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    print(f"{'звук':<20}{'саб':>8}{'низ':>8}{'сер':>8}{'верх':>8}   диагноз")

    fixed = []
    for rec in rows:
        f = rec.get("fields", {})
        url, name = f.get("Cloudinary"), f.get("Name", rec["id"])
        if not url:
            continue
        raw = tmp / (rec["id"] + ".mp3")
        try:
            urllib.request.urlretrieve(url, raw)
        except Exception as e:
            print(f"{name:<20} не скачался: {e}")
            continue

        m = measure(raw)
        vals = "".join(f"{m[b]:>8.1f}" if m[b] is not None else f"{'?':>8}"
                       for b in ("sub", "low", "mid", "high"))
        notes = diagnose(m)
        print(f"{name[:20]:<20}{vals}   {', '.join(notes)}")

        if a.fix and notes != ["в профиле"]:
            safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
            dst = out / f"{safe}.mp3"
            repair(raw, dst, m)
            after = measure(dst)
            print(f"{'  → после':<20}" + "".join(
                f"{after[b]:>8.1f}" if after[b] is not None else f"{'?':>8}"
                for b in ("sub", "low", "mid", "high")))
            fixed.append((rec["id"], name, dst))

    print(f"\nэталон              {TARGET['sub']:>8}{TARGET['low']:>8}"
          f"{TARGET['mid']:>8}{TARGET['high']:>8}")

    if a.fix:
        print(f"\n✓ починено {len(fixed)} в {out}/")
        print("  Послушай перед заливкой — эквализация не чинит плохой исходник.")

    if a.upload and fixed:
        try:
            import cloudinary, cloudinary.uploader
        except ImportError:
            sys.exit("pip3 install cloudinary")
        cloudinary.config(secure=True)
        for rec_id, name, path in fixed:
            r = cloudinary.uploader.upload(str(path), resource_type="video",
                                           folder="music/fixed")
            airtable("PATCH", f"{T_MUSIC}/{rec_id}", {"fields": {
                "Cloudinary": r["secure_url"],
                "description": (rows and next(
                    (x["fields"].get("description", "") for x in rows if x["id"] == rec_id), "")
                ) + " · спектр выровнен под киноэталон",
            }})
            print(f"  ↑ {name}")


if __name__ == "__main__":
    main()
