#!/usr/bin/env python3
"""Проверяет спеку ролика против пресета до рендера.

Выход: 0 — чисто (возможны WARN), 1 — есть ERROR.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import reelkit  # noqa: E402

VALID_TYPES = {"hook", "step", "cta"}


def check(spec, preset, logos):
    errors, warns = [], []
    fps = preset["canvas"]["fps"]
    frames = reelkit.shot_frames(preset)
    W = preset["canvas"]["width"]

    # --- тайминг
    raw = preset["timing"]["shot_seconds"] * fps
    if abs(raw - round(raw)) > 1e-9:
        warns.append(
            f"{preset['timing']['shot_seconds']}с x {fps}fps = {raw:g} кадра — не целое. "
            f"Округлено до {frames} ({frames/fps:.4f}с/план). "
            f"Дрейф к концу ролика: {abs(frames - raw)*len(spec['shots'])/fps*1000:.0f} мс"
        )

    shots = spec.get("shots") or []
    if not shots:
        errors.append("в спеке нет ни одного плана")
    if len(shots) > preset["timing"]["max_shots"]:
        errors.append(f"планов {len(shots)}, пресет разрешает {preset['timing']['max_shots']}")

    steps = [s for s in shots if s.get("type") == "step"]

    # --- планы
    for i, shot in enumerate(shots):
        tag = f"план {i:02d} ({shot.get('type','?')})"

        if shot.get("type") not in VALID_TYPES:
            errors.append(f"{tag}: неизвестный тип, допустимо {sorted(VALID_TYPES)}")

        if shot.get("type") == "step":
            key = shot.get("logo")
            if not key:
                errors.append(f"{tag}: у шага нет поля logo")
            elif key not in logos:
                errors.append(f"{tag}: логотипа '{key}' нет в assets/logo_index.json")
            elif not (reelkit.ROOT / "assets" / logos[key]["file"]).exists():
                errors.append(f"{tag}: файл лого не найден — assets/{logos[key]['file']}")

        voice = shot.get("voice", "").strip()
        if not voice:
            errors.append(f"{tag}: пустой voice — субтитрам нечего показывать")
        else:
            words = reelkit.split_words(voice)
            try:
                reelkit.allocate_word_frames(words, frames, preset["timing"]["min_word_frames"])
            except reelkit.SpecError as exc:
                errors.append(f"{tag}: {exc}. Сократи реплику")
            if len(words) > 8:
                warns.append(
                    f"{tag}: {len(words)} слов на {frames/fps:.2f}с — читается в спешке, "
                    f"комфортный потолок ~7"
                )

        # ширина заголовка — грубая оценка по ширине глифа DejaVu Sans Bold (~0.62em)
        head = shot.get("headline", "")
        if not head:
            errors.append(f"{tag}: нет headline")
        else:
            limit = W - 2 * preset["layout"]["safe_margin"]
            for line in reelkit._wrap(head, preset["typography"]["headline_wrap_chars"]):
                px = len(line) * preset["typography"]["headline_size"] * 0.62
                if px > limit:
                    errors.append(
                        f"{tag}: строка «{line}» ~{px:.0f}px при лимите {limit}px — вылезет за поля"
                    )

    # --- CTA
    keyword = (spec.get("cta_keyword") or "").strip()
    if not keyword:
        warns.append("cta_keyword не задан — подсветка ключевого слова выключена")
    elif not any(keyword.lower() in s.get("voice", "").lower() for s in shots):
        errors.append(f"cta_keyword '{keyword}' не встречается ни в одном voice — подсветка не сработает")

    if not any(s.get("type") == "cta" for s in shots):
        warns.append("нет плана типа cta — ролик закончится без призыва")

    # --- хронометраж
    total_s = len(shots) * frames / fps
    if total_s < 3:
        errors.append(f"хронометраж {total_s:.2f}с — Reels требует минимум 3с")
    elif total_s < 7:
        warns.append(f"хронометраж {total_s:.2f}с — коротко даже для Reels")

    return errors, warns, {"frames": frames, "shots": len(shots),
                           "steps": len(steps), "total_s": total_s}


def main():
    ap = argparse.ArgumentParser(description="Валидация спеки ролика")
    ap.add_argument("spec", help="reels/projects/<name>.json")
    args = ap.parse_args()

    spec = reelkit.load_spec(args.spec)
    preset = reelkit.load_preset(spec["preset"])
    logos = reelkit.load_logo_index()

    errors, warns, info = check(spec, preset, logos)

    print(f"спека   : {spec['id']}  (пресет {preset['id']} v{preset['version']})")
    print(f"планов  : {info['shots']}  из них шагов: {info['steps']}")
    print(f"кадр/план: {info['frames']}  ({info['frames']/preset['canvas']['fps']:.4f}с)")
    print(f"хроно   : {info['total_s']:.3f}с @ {preset['canvas']['fps']}fps")
    print()

    for w in warns:
        print(f"  WARN  {w}")
    for e in errors:
        print(f"  ERROR {e}")

    if not errors and not warns:
        print("  чисто")
    print()
    print("ИТОГ:", "провал" if errors else "готово к рендеру")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
