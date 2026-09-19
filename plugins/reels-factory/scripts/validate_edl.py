#!/usr/bin/env python3
"""
Проверяет edl.json до рендера. Ловит то, что портит ролик чаще всего.

    python3 scripts/validate_edl.py edl.json

Проверки:
  1. статика дольше 6 секунд          → зритель уходит
  2. склейка не привязана к слову     → монтаж по сетке, а не по речи
  3. anchor_word нет в words.json     → выдуманный таймкод
  4. музыка громче -20 LUFS           → забивает речь
  5. субтитры не покрывают речь       → дырки
  6. слайд без mockup или с 3+ строками в title
  7. пересечения слоёв одного типа
"""
import json, sys
from pathlib import Path

MAX_STATIC = 6.0
ANCHOR_TOLERANCE = 0.25

def main():
    edl_path = sys.argv[1] if len(sys.argv) > 1 else "edl.json"
    edl = json.loads(Path(edl_path).read_text())
    words = None
    if Path("words.json").exists():
        words = json.loads(Path("words.json").read_text())["words"]

    errors, warns = [], []
    tl = sorted(edl.get("timeline", []), key=lambda x: x["s"])
    dur = edl["meta"]["duration"]

    preset = edl.get("preset", "slides")
    max_static = {"yapping": 3.0, "split": 8.0, "scene": 8.0}.get(preset, MAX_STATIC)
    max_cap_words = 1 if edl.get("captions_style") == "word" else 6

    # вкус: один акцентный цвет на ролик. Второй — и ролик выглядит как шаблон.
    theme = edl.get("theme", {})
    NOT_ACCENT = {
        "panelTop", "panelBottom", "sceneBg", "badgeBg", "grid", "dot", "dotInk",
        "green", "blue", "textOn", "textOff", "cardWidth", "cardBottom", "cardRadius",
    }
    # цвет бренда в логотипе акцентом не считается — считается то, чем ты красишь СВОИ элементы
    accents = {k: v for k, v in theme.items()
               if k not in NOT_ACCENT and isinstance(v, str) and v.startswith("#")}
    if len(accents) > 1:
        errors.append(f"[вкус] {len(accents)} акцентных цвета ({', '.join(accents.values())}). "
                      f"Один акцент на ролик — остальное белый, серый и фон.")
    for key in ("glow", "neon", "shadow_color"):
        if theme.get(key):
            errors.append(f"[вкус] theme.{key} — цветное свечение читается как сток. Убери.")

    # 1. статика: план длиннее MAX_STATIC без движения внутри
    visual = [e for e in tl if e["type"] in
              ("aroll", "aroll_fullscreen", "panel", "slide", "broll", "pip",
               "scene", "badge_stack", "bigfig", "mockup")]
    marks = sorted({0.0} | {e["s"] for e in visual} | {e["e"] for e in visual} | {dur})
    for i in range(len(marks) - 1):
        a, b = marks[i], marks[i + 1]
        gap = b - a
        if gap <= max_static:
            continue
        # что оживляет план: чип внутри, анимированный фон, ускоренный скринкаст
        alive = [c for c in tl if c["type"] == "chip" and a <= c["s"] < b]
        alive += [e for e in visual
                  if e["s"] <= a and e["e"] >= b
                  and (e.get("bg") or (e.get("speed") or 1) > 1)]
        if not alive:
            errors.append(f"[статика] план {a:.1f}–{b:.1f}с длится {gap:.1f}с без движения. "
                          f"Потолок пресета {preset} — {max_static}с. Добавь chip, анимированный bg или сократи.")

    # 2 и 3. привязка к словам
    for e in tl:
        if e["type"] == "chip":
            continue
        if not e.get("anchor_word"):
            warns.append(f"[якорь] {e['type']} на {e['s']}с без anchor_word")
        elif words:
            hit = [w for w in words
                   if w["w"].lower().strip(".,!?—") == e["anchor_word"].lower().strip(".,!?—")]
            if not hit:
                errors.append(f"[якорь] слова «{e['anchor_word']}» нет в words.json "
                              f"({e['type']} на {e['s']}с)")

    # 4. музыка
    music = edl.get("audio", {}).get("music", {})
    if music.get("gain_db", -26) > -20:
        errors.append(f"[звук] музыка {music['gain_db']} dB — громче -20, забьёт речь")

    # 5. покрытие субтитрами
    caps = sorted(edl.get("captions", []), key=lambda c: c["s"])
    covered = sum(c["e"] - c["s"] for c in caps)
    if dur and covered / dur < 0.75:
        warns.append(f"[субтитры] покрывают {covered/dur*100:.0f}% ролика — есть немые куски")
    for i in range(len(caps) - 1):
        if caps[i]["e"] > caps[i + 1]["s"] + 0.01:
            errors.append(f"[субтитры] наложение на {caps[i+1]['s']}с")
        if len(caps[i]["text"].split()) > max_cap_words:
            warns.append(f"[субтитры] {caps[i]['s']}с: {len(caps[i]['text'].split())} слов "
                         f"при captions_style={edl.get('captions_style','phrase')} "
                         f"(потолок {max_cap_words})")

    # 6. слайды
    for e in tl:
        if e["type"] != "slide":
            continue
        if preset == "yapping":
            # слайд в yapping — это сырой скриншот фулскрином, без текста
            if not e.get("mockup"):
                errors.append(f"[слайд] {e['s']}с: в пресете yapping нужен mockup (скриншот)")
            continue
        if not e.get("title"):
            errors.append(f"[слайд] {e['s']}с без заголовка")
        elif e["title"].count("\n") > 1:
            warns.append(f"[слайд] {e['s']}с: заголовок больше 2 строк")
        if not e.get("mockup") and e.get("mockup_kind", "window") != "none":
            warns.append(f"[слайд] {e['s']}с без mockup — будет голый текст")
        if not e.get("eyebrow"):
            warns.append(f"[слайд] {e['s']}с без eyebrow — теряется счётчик шагов")

    # 6a. сцена (пресет scene)
    if preset == "scene":
        scenes = sorted([e for e in tl if e["type"] == "scene"], key=lambda x: x["s"])
        if not scenes:
            errors.append("[сцена] пресет scene без единого слоя scene — фон не задан")
        if len(scenes) > 5:
            warns.append(f"[сцена] {len(scenes)} смен фона. В референсе 4 на 56 секунд — "
                         f"смена фона это глава, а не перебивка")
        covered = sum(x["e"] - x["s"] for x in scenes)
        if dur and covered / dur < 0.98:
            errors.append(f"[сцена] слои scene покрывают {covered/dur*100:.0f}% ролика — "
                          f"под сценой будет чёрная дыра")
        for e in tl:
            if e["type"] == "badge_stack":
                b = e.get("badges") or []
                if not b:
                    errors.append(f"[бейджи] {e['s']}с: badge_stack без badges")
                elif len(b) > 5:
                    warns.append(f"[бейджи] {e['s']}с: {len(b)} штук — в 70% кадра влезает до 5")
            if e["type"] == "bigfig" and not e.get("big"):
                errors.append(f"[цифра] {e['s']}с: bigfig без поля big")
            if e["type"] == "mockup" and not e.get("mockup"):
                errors.append(f"[мокап] {e['s']}с: без скриншота")

    # 6b. панели (пресет split)
    for e in tl:
        if e["type"] != "panel":
            continue
        kind = e.get("panel_kind", "plain")
        if kind == "color" and not e.get("big"):
            errors.append(f"[панель] {e['s']}с: panel_kind=color без поля big (крупная цифра)")
        if kind == "mockup" and not e.get("mockup"):
            errors.append(f"[панель] {e['s']}с: panel_kind=mockup без скриншота")
        if kind == "plain" and not e.get("title"):
            errors.append(f"[панель] {e['s']}с: panel_kind=plain без заголовка")
        if e.get("title") and e["title"].count("\n") > 2:
            warns.append(f"[панель] {e['s']}с: заголовок больше 3 строк — в половину кадра не сядет")

    # 7. пересечения
    for kind in ("slide", "broll", "pip", "panel", "scene", "badge_stack", "bigfig"):
        same = sorted([e for e in tl if e["type"] == kind], key=lambda x: x["s"])
        for i in range(len(same) - 1):
            if same[i]["e"] > same[i + 1]["s"] + 0.01:
                errors.append(f"[слои] два {kind} пересекаются на {same[i+1]['s']}с")

    for e in errors:
        print(f"✗ {e}")
    for w in warns:
        print(f"! {w}")

    shots = len([e for e in visual]) or 1
    print(f"\nпресет {preset} · длина {dur}с · планов {shots} · средний {dur/shots:.1f}с "
          f"· субтитров {len(caps)} · чипов {len([e for e in tl if e['type']=='chip'])}")

    if errors:
        print(f"\n{len(errors)} ошибок — рендерить рано")
        sys.exit(1)
    print("\n✓ план валиден")

if __name__ == "__main__":
    main()
