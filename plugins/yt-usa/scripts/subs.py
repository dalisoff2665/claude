#!/usr/bin/env python3
"""Субтитры по словам из озвучки: SRT для YouTube + words.json для монтажа.

    python3 subs.py voice.mp3 --lang en --out subs.srt
    python3 subs.py voice.mp3 --model large-v3 --max-chars 32

Нужен faster-whisper: pip install faster-whisper
Модель скачивается один раз при первом запуске.
"""
import argparse
import json
import sys
from pathlib import Path


def ts(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def group(words, max_chars=42, max_dur=3.5, min_gap=0.6):
    """Слова → реплики. Режем по концу предложения, паузе, длине строки или времени."""
    cues, cur = [], []
    for w in words:
        text = w["word"].strip()
        if not text:
            continue
        if cur:
            line = " ".join(x["word"].strip() for x in cur + [w])
            gap = w["start"] - cur[-1]["end"]
            too_long = len(line) > max_chars or (w["end"] - cur[0]["start"]) > max_dur
            if gap >= min_gap or too_long:
                cues.append(cur)
                cur = []
        cur.append(w)
        if text[-1] in ".?!":
            cues.append(cur)
            cur = []
    if cur:
        cues.append(cur)
    return [{"start": c[0]["start"], "end": c[-1]["end"],
             "text": " ".join(x["word"].strip() for x in c)} for c in cues]


def to_srt(cues):
    out = []
    for i, c in enumerate(cues, 1):
        end = max(c["end"], c["start"] + 0.5)
        if i < len(cues):
            end = min(end, cues[i]["start"])
        out.append(f"{i}\n{ts(c['start'])} --> {ts(end)}\n{c['text']}\n")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio", type=Path)
    ap.add_argument("--lang", default="en")
    ap.add_argument("--model", default="small")
    ap.add_argument("--out", type=Path, default=Path("subs.srt"))
    ap.add_argument("--words", type=Path, default=Path("words.json"))
    ap.add_argument("--max-chars", type=int, default=42)
    args = ap.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("✗ нет faster-whisper: pip install faster-whisper")
    if not args.audio.exists():
        sys.exit(f"✗ нет файла {args.audio}")

    model = WhisperModel(args.model, device="auto", compute_type="auto")
    segments, _ = model.transcribe(str(args.audio), language=args.lang, word_timestamps=True, vad_filter=True)
    words = [{"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3)}
             for seg in segments for w in (seg.words or [])]
    if not words:
        sys.exit("✗ в аудио не найдено речи")

    args.words.write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")
    cues = group(words, max_chars=args.max_chars)
    args.out.write_text(to_srt(cues), encoding="utf-8")
    print(f"✓ {args.out}: {len(cues)} реплик · {args.words}: {len(words)} слов")


if __name__ == "__main__":
    main()
