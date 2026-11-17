#!/usr/bin/env python3
"""Бесплатная озвучка рилса голосом Microsoft (edge-tts) с таймкодами слов.

    pip install edge-tts
    python3 tts_edge.py script.json --voice ru-RU-DmitryNeural --rate +8%

Выход тот же, что у tts.py: build/voice.wav и build/timeline.json.
"""
import argparse
import asyncio
import json
import subprocess
import sys
import wave
from pathlib import Path

D = Path(__file__).parent
sys.path.insert(0, str(D))
from tts import tokens  # noqa: E402
from retime import align  # noqa: E402

RATE = 44100


async def synth(text, voice, rate, mp3):
    import os
    import ssl
    import aiohttp
    import edge_tts
    kw = {}
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy:  # облачная сессия: прокси со своим корневым сертификатом
        ca = os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt"
        kw["proxy"] = proxy
        kw["connector"] = aiohttp.TCPConnector(ssl=ssl.create_default_context(cafile=ca if os.path.exists(ca) else None))
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary", **kw)
    words = []
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                s = ch["offset"] / 1e7
                words.append({"word": ch["text"], "start": s, "end": s + ch["duration"] / 1e7})
    return words


def synth_robust(text, voice, rate, mp3):
    """edge-tts иногда молча не отдаёт звук: 3 попытки, потом режем по знакам препинания."""
    import re
    import time
    # сервис иногда отказывает на конкретной строке: пробуем ту же фразу с другой пунктуацией
    variants = [text, re.sub(r"\.$", "!", text), re.sub(r"\.$", "…", text), text.replace(" — ", ", "),
                text.replace(" — ", ", ").rstrip(".") + "!", re.sub(r"\.$", ";", text)]
    for attempt, v in enumerate(list(dict.fromkeys(variants)) * 3):
        try:
            return asyncio.run(synth(v, voice, rate, mp3))
        except Exception as e:  # NoAudioReceived и сетевые обрывы
            print(f"    вариант {attempt + 1}: {type(e).__name__}")
            time.sleep(1.0)
    parts = [x for x in re.split(r"(?<=[.?!,:—])\s+", text) if x.strip()]
    if len(parts) < 2:  # без знаков препинания режем по союзу «и»
        parts = [x for x in re.split(r"\s(?=и\s)", text) if x.strip()]
    if len(parts) < 2:
        raise SystemExit(f"✗ edge-tts не озвучил: {text}")
    words, chunks, off = [], [], 0.0
    for k, part in enumerate(parts):
        sub = mp3.with_name(f"{mp3.stem}-{k}.mp3")
        ws = synth_robust(part, voice, rate, sub)
        words += [{"word": w["word"], "start": w["start"] + off, "end": w["end"] + off} for w in ws]
        chunks.append(sub)
        off += len(pcm(sub)) / 2 / RATE
    lst = mp3.with_suffix(".txt")
    lst.write_text("".join(f"file '{c.resolve()}'\n" for c in chunks))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(mp3)], check=True)
    return words


def pcm(mp3):
    return subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp3), "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"],
                          capture_output=True, check=True).stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script", type=Path)
    ap.add_argument("--voice", default="ru-RU-DmitryNeural")
    ap.add_argument("--rate", default="+8%")
    ap.add_argument("--out", type=Path, default=D / "build")
    ap.add_argument("--tempo", type=float, default=1.0, help="ускорить итог через atempo, например 1.25")
    args = ap.parse_args()
    cfg = json.loads(args.script.read_text(encoding="utf-8"))
    args.out.mkdir(parents=True, exist_ok=True)
    pause = float(cfg.get("pause", 0.12))
    silence = b"\x00\x00" * int(RATE * pause)
    audio, timeline, t = bytearray(), [], 0.0

    for i, s in enumerate(cfg["sentences"]):
        toks = tokens(s["text"])
        mp3 = args.out / f"edge-{i:02d}.mp3"
        heard = synth_robust(" ".join(sp for _, sp in toks), args.voice, args.rate, mp3)
        raw = pcm(mp3)
        dur = len(raw) / 2 / RATE
        times, ratio = align([(i, d, sp) for d, sp in toks], heard)
        words = [{"text": d, "start": round(t + a, 3), "end": round(t + b, 3)} for (d, _), (a, b) in zip(toks, times)]
        timeline.append({"scene": s["scene"], "start": round(t, 3), "end": round(t + dur, 3),
                         "text": " ".join(d for d, _ in toks), "words": words})
        audio += raw + silence
        t += dur + pause
        print(f"  {i + 1:2d}. {dur:5.2f} с  совпало {ratio:.0%}  {s['text'][:50]}")

    with wave.open(str(args.out / "voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(audio))
    if args.tempo != 1.0:  # ускорение без смены тембра, таймкоды делятся на тот же коэффициент
        k = args.tempo
        tmp = args.out / "voice_tempo.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(args.out / "voice.wav"), "-af", f"atempo={k}", str(tmp)], check=True)
        tmp.replace(args.out / "voice.wav")
        t /= k
        for s in timeline:
            s["start"], s["end"] = round(s["start"] / k, 3), round(s["end"] / k, 3)
            for w in s["words"]:
                w["start"], w["end"] = round(w["start"] / k, 3), round(w["end"] / k, 3)
    (args.out / "timeline.json").write_text(json.dumps({"duration": round(t, 3), "sentences": timeline},
                                                       ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✓ build/voice.wav  {t:.2f} с · timeline.json")


if __name__ == "__main__":
    main()
