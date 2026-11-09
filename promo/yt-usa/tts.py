#!/usr/bin/env python3
"""Озвучка рилса через Cartesia с таймкодами слов.

    python3 tts.py script.json --out build/

Токен вида «vidIQ|Видайкью» — слева то, что видно в субтитрах, справа — что произносится.
Ключ: CARTESIA_API_KEY из окружения (в облачной сессии ключ подставляет прокси).
Выход: build/voice.wav и build/timeline.json (предложения и слова с временем).
"""
import argparse
import base64
import json
import os
import re
import subprocess
import sys
import urllib.request
import wave
from pathlib import Path

RATE = 44100
SPEED = 1.15
API = "https://api.cartesia.ai/tts/sse"


def tokens(text):
    """Пары (видимое, произносимое). Одиночные тире приклеиваются к предыдущему слову."""
    out = []
    for raw in text.split():
        disp, _, spoken = raw.partition("|")
        spoken = spoken or disp
        if re.fullmatch(r"[—–-]+", disp) and out:
            out[-1] = (out[-1][0] + " " + disp, out[-1][1] + " " + spoken)
            continue
        out.append((disp, spoken))
    return out


def synth(spoken_text, voice_id, key):
    body = json.dumps({
        "model_id": "sonic-3",
        "transcript": spoken_text,
        "voice": {"mode": "id", "id": voice_id},
        "language": "ru",
        "output_format": {"container": "raw", "encoding": "pcm_s16le", "sample_rate": RATE},
        "add_timestamps": True,
        "generation_config": {"speed": SPEED},
    }).encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "Cartesia-Version": "2025-04-16",
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    })
    pcm, words = bytearray(), []
    with urllib.request.urlopen(req, timeout=120) as resp:
        for line in resp:
            line = line.decode().strip()
            if not line.startswith("data:"):
                continue
            ev = json.loads(line[5:])
            if ev.get("type") == "chunk" and ev.get("data"):
                pcm += base64.b64decode(ev["data"])
            elif ev.get("type") == "timestamps":
                wt = ev.get("word_timestamps") or {}
                for w, s, e in zip(wt.get("words", []), wt.get("start", []), wt.get("end", [])):
                    if re.fullmatch(r"[—–\-.,:;!?«»]+", w.strip()):
                        continue  # тире и знаки — не слова
                    words.append({"spoken": w, "start": s, "end": e})
            elif ev.get("type") == "error":
                sys.exit(f"✗ Cartesia: {ev}")
    return bytes(pcm), words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script", type=Path)
    ap.add_argument("--out", type=Path, default=Path("build"))
    ap.add_argument("--tempo", type=float, default=1.0, help="ускорить итог через atempo, например 1.08")
    args = ap.parse_args()
    cfg = json.loads(args.script.read_text(encoding="utf-8"))
    key = os.environ.get("CARTESIA_API_KEY", "proxy-injected")
    args.out.mkdir(parents=True, exist_ok=True)

    pause = float(cfg.get("pause", 0.16))
    silence = b"\x00\x00" * int(RATE * pause)
    audio, timeline, t = bytearray(), [], 0.0

    for i, s in enumerate(cfg["sentences"]):
        toks = tokens(s["text"])
        spoken = " ".join(sp for _, sp in toks)
        pcm, words = synth(spoken, cfg["voice_id"], key)
        dur = len(pcm) / 2 / RATE
        if len(words) != len(toks):
            print(f"! предложение {i + 1}: слов в ответе {len(words)}, токенов {len(toks)} — время по длине слов")
            total_chars = sum(len(sp) for _, sp in toks) or 1
            start = words[0]["start"] if words else 0.05
            end = words[-1]["end"] if words else dur - 0.05
            words, acc = [], start
            for _, sp in toks:
                w = (end - start) * len(sp) / total_chars
                words.append({"spoken": sp, "start": acc, "end": acc + w})
                acc += w
        sent_words = [{"text": d, "start": round(t + w["start"], 3), "end": round(t + w["end"], 3)}
                      for (d, _), w in zip(toks, words)]
        timeline.append({"scene": s["scene"], "start": round(t, 3), "end": round(t + dur, 3),
                         "text": " ".join(d for d, _ in toks), "words": sent_words})
        audio += pcm + silence
        t += dur + pause
        print(f"  {i + 1:2d}. {dur:5.2f} с  {s['text'][:60]}")

    wav = args.out / ("voice_raw.wav" if args.tempo != 1.0 else "voice.wav")
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(audio))
    if args.tempo != 1.0:
        k = args.tempo
        final = args.out / "voice.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-af", f"atempo={k}", str(final)], check=True)
        wav, t = final, t / k
        for s in timeline:
            s["start"], s["end"] = round(s["start"] / k, 3), round(s["end"] / k, 3)
            for w in s["words"]:
                w["start"], w["end"] = round(w["start"] / k, 3), round(w["end"] / k, 3)
    (args.out / "timeline.json").write_text(json.dumps({"duration": round(t, 3), "sentences": timeline},
                                                       ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✓ {wav}  {t:.2f} с · timeline.json")


if __name__ == "__main__":
    main()
