#!/usr/bin/env python3
"""Переозвучить рилс своим голосом: запись → таймкоды слов → timeline.json.

    python3 retime.py my_voice.m4a            # своя запись или озвучка клоном HeyGen/ElevenLabs
    node render.cjs && python3 mix.py         # пересобрать видео под новый голос

Читай текст из script.json (правую часть «видно|произносится»), темп — свой.
Нужен faster-whisper: pip install faster-whisper (модель скачается один раз).
"""
import argparse
import difflib
import json
import re
import subprocess
import sys
from pathlib import Path

D = Path(__file__).parent
sys.path.insert(0, str(D))
from tts import tokens  # noqa: E402


def norm(w):
    return re.sub(r"[^\wё]", "", w.lower().replace("ё", "е"))


def align(script, heard):
    """script: [(sentence_idx, display, spoken)], heard: [{word,start,end}] → время каждого токена."""
    a = [norm(sp) for _, _, sp in script]
    b = [norm(h["word"]) for h in heard]
    times = [None] * len(script)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k]["start"], heard[j1 + k]["end"])
        elif tag == "replace" and (j2 - j1) > 0:
            s, e = heard[j1]["start"], heard[j2 - 1]["end"]
            n = i2 - i1
            for k in range(n):
                times[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    # дыры — линейно между соседями
    known = [i for i, t in enumerate(times) if t]
    if not known:
        sys.exit("✗ запись не совпала со сценарием")
    for i, t in enumerate(times):
        if t:
            continue
        prev = max((k for k in known if k < i), default=None)
        nxt = min((k for k in known if k > i), default=None)
        s = times[prev][1] if prev is not None else max(0.0, times[nxt][0] - 0.3)
        e = times[nxt][0] if nxt is not None else times[prev][1] + 0.3
        times[i] = (s, e)
    matched = sum(1 for tag, i1, i2, *_ in sm.get_opcodes() if tag == "equal" for _ in range(i2 - i1))
    return times, matched / len(script)


def build_timeline(cfg, heard, duration):
    script = [(si, d, sp) for si, s in enumerate(cfg["sentences"]) for d, sp in tokens(s["text"])]
    times, ratio = align(script, heard)
    sents = []
    for si, s in enumerate(cfg["sentences"]):
        idx = [i for i, x in enumerate(script) if x[0] == si]
        words = [{"text": script[i][1], "start": round(times[i][0], 3), "end": round(times[i][1], 3)} for i in idx]
        sents.append({"scene": s["scene"], "start": words[0]["start"], "end": words[-1]["end"],
                      "text": " ".join(w["text"] for w in words), "words": words})
    for i in range(len(sents) - 1):  # предложение начинается сразу после предыдущего
        sents[i + 1]["start"] = max(sents[i]["end"], sents[i + 1]["start"] - 0.1)
    sents[0]["start"] = 0.0
    return {"duration": round(duration, 3), "sentences": sents}, ratio


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio", type=Path)
    ap.add_argument("--script", type=Path, default=D / "script.json")
    ap.add_argument("--model", default="small")
    args = ap.parse_args()
    cfg = json.loads(args.script.read_text(encoding="utf-8"))
    out = D / "build"
    out.mkdir(exist_ok=True)

    wav = out / "voice.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(args.audio), "-ac", "1", "-ar", "44100", str(wav)], check=True)
    duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                              "-of", "csv=p=0", str(wav)]).decode())
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("✗ pip install faster-whisper")
    model = WhisperModel(args.model, device="auto", compute_type="auto")
    segs, _ = model.transcribe(str(wav), language="ru", word_timestamps=True, vad_filter=False)
    heard = [{"word": w.word, "start": w.start, "end": w.end} for s in segs for w in (s.words or [])]

    tl, ratio = build_timeline(cfg, heard, duration)
    (out / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✓ build/timeline.json · {duration:.2f} с · совпало слов: {ratio:.0%}")
    if ratio < 0.8:
        print("! меньше 80% слов совпало со сценарием — проверь, что читал текст из script.json")


if __name__ == "__main__":
    main()
