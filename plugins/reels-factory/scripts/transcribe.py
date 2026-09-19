#!/usr/bin/env python3
"""
Словные таймкоды A-roll. Без этого монтажа не будет.

    pip3 install faster-whisper
    python3 scripts/transcribe.py raw/aroll.mp4

Отдаёт words.json:
{
  "duration": 52.4,
  "language": "ru",
  "words":    [{"w": "нейросети", "s": 0.42, "e": 0.98, "prob": 0.99}, ...],
  "segments": [{"text": "...", "s": 0.4, "e": 4.2}, ...],
  "gaps":     [{"s": 12.1, "e": 13.0, "len": 0.9}]   ← кандидаты на вырез
}

model: large-v3 — качество; medium — если Mac слабый; на Apple Silicon compute_type="int8".
"""
import argparse, json, sys
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--out", default="words.json")
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--lang", default="ru")
    ap.add_argument("--gap", type=float, default=0.6,
                    help="пауза длиннее этого попадает в кандидаты на вырез")
    a = ap.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("pip3 install faster-whisper")

    print(f"→ модель {a.model}")
    model = WhisperModel(a.model, device="auto", compute_type="int8")

    print(f"→ распознаю {a.audio}")
    segments, info = model.transcribe(
        a.audio, language=a.lang, word_timestamps=True,
        vad_filter=True, vad_parameters={"min_silence_duration_ms": 300},
    )

    words, segs = [], []
    for seg in segments:
        segs.append({"text": seg.text.strip(), "s": round(seg.start, 3), "e": round(seg.end, 3)})
        for w in (seg.words or []):
            words.append({
                "w": w.word.strip(),
                "s": round(w.start, 3),
                "e": round(w.end, 3),
                "prob": round(w.probability, 2),
            })
        print(f"  [{seg.start:6.2f}] {seg.text.strip()[:70]}")

    gaps = []
    for i in range(len(words) - 1):
        d = words[i + 1]["s"] - words[i]["e"]
        if d >= a.gap:
            gaps.append({"s": round(words[i]["e"], 3),
                         "e": round(words[i + 1]["s"], 3),
                         "len": round(d, 2)})

    out = {
        "duration": round(info.duration, 3),
        "language": info.language,
        "word_count": len(words),
        "words": words,
        "segments": segs,
        "gaps": gaps,
    }
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=2))
    dead = sum(g["len"] for g in gaps)
    print(f"\n✓ {a.out}: {len(words)} слов, {len(gaps)} пауз ({dead:.1f}с мёртвого времени)")

if __name__ == "__main__":
    main()
