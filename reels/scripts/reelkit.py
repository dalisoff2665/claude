"""Ядро пайплайна: загрузка спеки, покадровый тайминг, сборка кадров и субтитров."""

import base64
import json
import re
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent


class SpecError(Exception):
    """Спека или пресет не проходят проверку."""


# --------------------------------------------------------------------------- загрузка

def load_preset(name):
    path = ROOT / "presets" / f"{name}.json"
    if not path.exists():
        raise SpecError(f"пресет не найден: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_spec(path):
    path = Path(path)
    if not path.is_absolute():
        path = ROOT / "projects" / path.name
    if not path.exists():
        raise SpecError(f"спека не найдена: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_logo_index():
    data = json.loads((ROOT / "assets" / "logo_index.json").read_text(encoding="utf-8"))
    return data["logos"]


# --------------------------------------------------------------------------- тайминг

def shot_frames(preset):
    """Секунды на план -> целое число кадров. 1.7с * 24fps = 40.8 -> 41."""
    fps = preset["canvas"]["fps"]
    raw = preset["timing"]["shot_seconds"] * fps
    mode = preset["timing"].get("frame_rounding", "nearest")
    if mode == "floor":
        return int(raw)
    if mode == "ceil":
        return int(raw) + (1 if raw % 1 else 0)
    return int(raw + 0.5)


def split_words(text):
    return [w for w in re.split(r"\s+", text.strip()) if w]


def allocate_word_frames(words, total_frames, min_frames):
    """Раскидывает кадры плана по словам пропорционально длине.

    Сумма всегда ровно total_frames — иначе субтитры уезжают от картинки.
    """
    n = len(words)
    if n == 0:
        return []
    if n * min_frames > total_frames:
        raise SpecError(
            f"{n} слов x минимум {min_frames} кадров > {total_frames} кадров плана"
        )

    weights = [len(w) + 1 for w in words]
    total_w = sum(weights)
    raw = [total_frames * w / total_w for w in weights]
    alloc = [int(x) for x in raw]

    # остаток — методу наибольшего остатка
    order = sorted(range(n), key=lambda i: raw[i] - alloc[i], reverse=True)
    for k in range(total_frames - sum(alloc)):
        alloc[order[k % n]] += 1

    # добираем до минимума, занимая у самых длинных
    guard = 0
    while any(a < min_frames for a in alloc):
        guard += 1
        if guard > 1000:
            raise SpecError("не сходится минимальная длительность слова")
        i = next(i for i, a in enumerate(alloc) if a < min_frames)
        j = max(range(n), key=lambda k: alloc[k])
        if alloc[j] - 1 < min_frames:
            raise SpecError("не сходится минимальная длительность слова")
        alloc[j] -= 1
        alloc[i] += 1

    if sum(alloc) != total_frames:
        raise SpecError("внутренняя ошибка раскладки кадров")
    return alloc


def build_timeline(spec, preset):
    """[{index, type, start_frame, frames, words:[{text,start_frame,frames}]}]"""
    frames = shot_frames(preset)
    min_wf = preset["timing"]["min_word_frames"]
    timeline, cursor = [], 0

    for i, shot in enumerate(spec["shots"]):
        words = split_words(shot.get("voice", ""))
        alloc = allocate_word_frames(words, frames, min_wf) if words else []
        wcur, wlist = cursor, []
        for w, f in zip(words, alloc):
            wlist.append({"text": w, "start_frame": wcur, "frames": f})
            wcur += f
        timeline.append(
            {"index": i, "type": shot["type"], "start_frame": cursor,
             "frames": frames, "shot": shot, "words": wlist}
        )
        cursor += frames

    return timeline, cursor


# --------------------------------------------------------------------------- кадры

def _wrap(text, width):
    """Уважает явные \\n, длинные строки переносит жадно."""
    out = []
    for para in text.split("\n"):
        line = ""
        for word in para.split():
            cand = f"{line} {word}".strip()
            if len(cand) > width and line:
                out.append(line)
                line = word
            else:
                line = cand
        out.append(line)
    return [l for l in out if l]


def _logo_data_uri(logo, size):
    """Растрим лого в PNG 2x и отдаём data-URI (librsvg надёжнее с ним, чем с href)."""
    src = ROOT / "assets" / logo["file"]
    if not src.exists():
        raise SpecError(f"лого не найдено: {src}")
    png = subprocess.run(
        ["rsvg-convert", "-w", str(size * 2), "-h", str(size * 2), str(src)],
        check=True, capture_output=True,
    ).stdout
    return "data:image/png;base64," + base64.b64encode(png).decode("ascii")


def build_shot_svg(entry, spec, preset, logos, step_no, step_total, overlay=False):
    p, lay, typ = preset["palette"], preset["layout"], preset["typography"]
    W, H = preset["canvas"]["width"], preset["canvas"]["height"]
    shot, kind = entry["shot"], entry["type"]

    logo = logos.get(shot["logo"]) if kind == "step" else None
    glow = logo["color"] if logo else p["accent"]

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'viewBox="0 0 {W} {H}">',
        '<defs>',
        f'<radialGradient id="glow" cx="50%" cy="38%" r="62%">',
        f'<stop offset="0%" stop-color="{glow}" stop-opacity="{p["bg_glow_opacity"]}"/>',
        f'<stop offset="100%" stop-color="{glow}" stop-opacity="0"/>',
        '</radialGradient>',
        '<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">',
        '<stop offset="0%" stop-color="#000000" stop-opacity="0.72"/>',
        '<stop offset="42%" stop-color="#000000" stop-opacity="0.18"/>',
        '<stop offset="100%" stop-color="#000000" stop-opacity="0.80"/>',
        '</linearGradient>',
        '</defs>',
    ]
    # standalone — плотный фон; overlay — прозрачный слой поверх говорящей головы
    if overlay:
        parts.append(f'<rect width="{W}" height="{H}" fill="url(#scrim)"/>')
    else:
        parts.append(f'<rect width="{W}" height="{H}" fill="{p["bg"]}"/>')
    parts.append(f'<rect width="{W}" height="{H}" fill="url(#glow)"/>')

    if kind == "step":
        # плашка-счётчик
        pw, ph = lay["plaque_w"], lay["plaque_h"]
        px, py = (W - pw) / 2, lay["plaque_top"]
        parts.append(
            f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="{ph/2}" '
            f'fill="{p["plaque_bg"]}"/>'
        )
        parts.append(
            f'<text x="{W/2}" y="{py + ph*0.68}" font-family="{typ["font_family"]}" '
            f'font-size="{typ["plaque_size"]}" font-weight="bold" fill="{p["plaque_fg"]}" '
            f'text-anchor="middle" letter-spacing="2">{step_no:02d} / {step_total:02d}</text>'
        )
        # лого
        ls = lay["logo_size"]
        parts.append(
            f'<image x="{(W-ls)/2}" y="{lay["logo_top"]}" width="{ls}" height="{ls}" '
            f'href="{_logo_data_uri(logo, ls)}"/>'
        )
        head_top = lay["headline_top"]
    else:
        head_top = 760

    # заголовок — ключевое слово CTA красим акцентом
    keyword = (spec.get("cta_keyword") or "").strip().lower()

    def inner(line):
        if not keyword:
            return escape(line)
        chunks = []
        for word in line.split(" "):
            bare = re.sub(r"[^\w]", "", word, flags=re.UNICODE).lower()
            if bare == keyword:
                chunks.append(f'<tspan fill="{p["accent"]}">{escape(word)}</tspan>')
            else:
                chunks.append(escape(word))
        return " ".join(chunks)

    lines = _wrap(shot.get("headline", ""), typ["headline_wrap_chars"])
    lh = typ["headline_line_height"]
    for n, line in enumerate(lines):
        parts.append(
            f'<text x="{W/2}" y="{head_top + n*lh}" font-family="{typ["font_family"]}" '
            f'font-size="{typ["headline_size"]}" font-weight="bold" fill="{p["fg"]}" '
            f'text-anchor="middle">{inner(line)}</text>'
        )

    # подпись
    if shot.get("note"):
        parts.append(
            f'<text x="{W/2}" y="{head_top + len(lines)*lh + lay["note_gap"]}" '
            f'font-family="{typ["font_family"]}" font-size="{typ["note_size"]}" '
            f'fill="{p["muted"]}" text-anchor="middle">{escape(shot["note"])}</text>'
        )

    parts.append("</svg>")
    return "\n".join(parts)


# --------------------------------------------------------------------------- субтитры

def _ass_color(hex_color):
    """#RRGGBB -> &HBBGGRR& (ASS хранит цвет задом наперёд)."""
    h = hex_color.lstrip("#")
    return f"&H{h[4:6]}{h[2:4]}{h[0:2]}&"


def _ass_time(frame, fps):
    total_cs = round(frame / fps * 100)
    h, rem = divmod(total_cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


def build_ass(timeline, spec, preset):
    """Субтитры по одному слову. Каждое слово — отдельное событие с \\pos и поп-анимацией."""
    fps = preset["canvas"]["fps"]
    typ, lay, p = preset["typography"], preset["layout"], preset["palette"]
    subs = preset["subtitles"]
    W = preset["canvas"]["width"]

    keyword = (spec.get("cta_keyword") or "").lower()
    accent = _ass_color(p["accent"])

    head = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {W}",
        f"PlayResY: {preset['canvas']['height']}",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour,"
        " BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle,"
        " BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Word,{typ['font_family']},{typ['subtitle_size']},{_ass_color(p['fg'])},"
        f"&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,"
        f"{subs['outline']},{subs['shadow']},5,60,60,60,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    y = lay["subtitle_baseline"]
    events = []
    for entry in timeline:
        for w in entry["words"]:
            text = w["text"].upper() if subs.get("uppercase") else w["text"]
            bare = re.sub(r"[^\w]", "", w["text"], flags=re.UNICODE).lower()
            color = ""
            if subs.get("highlight_cta_keyword") and keyword and bare == keyword:
                color = f"\\c{accent}"
            tags = f"{{\\pos({W//2},{y}){color}\\fscx112\\fscy112\\t(0,90,\\fscx100\\fscy100)}}"
            events.append(
                f"Dialogue: 0,{_ass_time(w['start_frame'], fps)},"
                f"{_ass_time(w['start_frame'] + w['frames'], fps)},Word,,0,0,0,,{tags}{text}"
            )

    return "\n".join(head + events) + "\n"
