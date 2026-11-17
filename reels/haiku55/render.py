"""Motion-graphics renderer for the Haiku 5.5 reel (1080x1920, 30fps, silent).

Usage: python3 render.py out.mp4
Scene timings follow the word timestamps of the voiceover (see storyboard.md).
"""
import math
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
DUR = 63.7
FONT_DIR = "/usr/share/fonts/opentype/inter/"

BG = (10, 10, 15)
WHITE = (245, 245, 247)
GREY = (140, 140, 150)
DIM = (60, 60, 72)
CORAL = (217, 119, 87)
GREEN = (37, 211, 102)
RED = (255, 77, 77)

_fonts = {}


def font(weight, size):
    key = (weight, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(f"{FONT_DIR}Inter-{weight}.otf", size)
    return _fonts[key]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def prog(t, start, dur=0.4):
    return ease((t - start) / dur)


# ---------- drawing primitives (each element on its own small layer) ----------

_text_cache = {}


def text_layer(text, weight, size, color):
    key = (text, weight, size, color)
    if key not in _text_cache:
        f = font(weight, size)
        l, t, r, b = f.getbbox(text)
        img = Image.new("RGBA", (r - l + 8, b - t + 8), (0, 0, 0, 0))
        ImageDraw.Draw(img).text((4 - l, 4 - t), text, font=f, fill=color)
        _text_cache[key] = img
    return _text_cache[key]


def paste(frame, layer, cx, cy, alpha=1.0, scale=1.0, anchor="c"):
    if alpha <= 0.01:
        return
    if abs(scale - 1) > 0.01:
        layer = layer.resize(
            (max(1, int(layer.width * scale)), max(1, int(layer.height * scale))),
            Image.LANCZOS,
        )
    if alpha < 0.99:
        layer = layer.copy()
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
    if anchor == "c":
        x, y = int(cx - layer.width / 2), int(cy - layer.height / 2)
    else:  # left-center
        x, y = int(cx), int(cy - layer.height / 2)
    frame.alpha_composite(layer, (x, y))


def text(frame, s, weight, size, color, cx, cy, alpha=1.0, scale=1.0, anchor="c"):
    paste(frame, text_layer(s, weight, size, color), cx, cy, alpha, scale, anchor)


def rrect(frame, box, radius, fill=None, outline=None, width=0, alpha=1.0):
    if alpha <= 0.01:
        return
    x0, y0, x1, y1 = [int(v) for v in box]
    layer = Image.new("RGBA", (x1 - x0 + 2, y1 - y0 + 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    fa = lambda c: None if c is None else (*c[:3], int((c[3] if len(c) > 3 else 255) * alpha))
    d.rounded_rectangle((0, 0, x1 - x0, y1 - y0), radius, fill=fa(fill), outline=fa(outline), width=width)
    frame.alpha_composite(layer, (x0, y0))


def check_icon(frame, cx, cy, r, color, alpha):
    if alpha <= 0.01:
        return
    layer = Image.new("RGBA", (2 * r + 4, 2 * r + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    c = (*color, int(255 * alpha))
    d.ellipse((2, 2, 2 * r + 2, 2 * r + 2), fill=c)
    k = r / 22
    pts = [(2 + r - 10 * k, 2 + r), (2 + r - 3 * k, 2 + r + 8 * k), (2 + r + 11 * k, 2 + r - 8 * k)]
    d.line(pts, fill=(10, 10, 15, int(255 * alpha)), width=max(3, int(5 * k)), joint="curve")
    frame.alpha_composite(layer, (int(cx - r - 2), int(cy - r - 2)))


def chat_bubble(frame, cx, cy, w, h, color, alpha):
    if alpha <= 0.01:
        return
    layer = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    c = (*color, int(255 * alpha))
    d.rounded_rectangle((0, 0, w, h), 40, fill=c)
    d.polygon([(30, h - 10), (10, h + 36), (90, h - 10)], fill=c)
    frame.alpha_composite(layer, (int(cx - w / 2), int(cy - h / 2)))


# ---------- background ----------

def make_bg():
    bg = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse((-300, -500, 900, 600), fill=(70, 34, 24))
    d.ellipse((400, 1300, 1500, 2300), fill=(20, 30, 50))
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    bg = Image.blend(bg, glow, 0.9)
    d = ImageDraw.Draw(bg)
    for x in range(0, W, 90):
        d.line((x, 0, x, H), fill=(18, 18, 26), width=1)
    for y in range(0, H, 90):
        d.line((0, y, W, y), fill=(18, 18, 26), width=1)
    return bg.convert("RGBA")


# ---------- scenes ----------
# each: (start, end, fn(frame, t_abs, alpha_scene))

CY = 860  # visual centre of the content zone


def s_hook(f, t, a):
    p = prog(t, 0.0, 0.5)
    text(f, "СКОЛЬКО СТОИТ", "Bold", 52, GREY, W / 2, CY - 360, a * p)
    chat_bubble(f, W / 2, CY - 120, 760, 200, GREEN, a * prog(t, 0.3))
    text(f, "1 диалог", "Black", 96, BG, W / 2, CY - 140, a * prog(t, 0.4))
    text(f, "WhatsApp-агента", "Bold", 64, WHITE, W / 2, CY + 80, a * prog(t, 2.2))
    pulse = 1 + 0.06 * math.sin(t * 8)
    text(f, "= ? ₸", "Black", 220, CORAL, W / 2, CY + 300, a * prog(t, 0.8), pulse * (0.7 + 0.3 * prog(t, 0.8)))


def s_title(f, t, a):
    p = prog(t, 3.25, 0.5)
    text(f, "Claude", "Bold", 110, WHITE, W / 2, CY - 170, a * p, 0.8 + 0.2 * p)
    text(f, "Haiku 5.5", "Black", 190, CORAL, W / 2, CY + 10, a * prog(t, 4.9), 0.8 + 0.2 * prog(t, 4.9))
    q = prog(t, 3.6)
    rrect(f, (W / 2 - 230, CY + 200, W / 2 + 230, CY + 300), 50, fill=(*CORAL, 40), outline=CORAL, width=3, alpha=a * q)
    text(f, "вышла 7 октября", "SemiBold", 48, WHITE, W / 2, CY + 250, a * q)


def price_card(f, x0, label, value, color, p, a):
    y = CY - 230 + (1 - p) * 120
    rrect(f, (x0, y, x0 + 460, y + 400), 40, fill=(26, 26, 36), outline=color, width=4, alpha=a * p)
    text(f, label, "Bold", 46, GREY, x0 + 230, y + 90, a * p)
    text(f, value, "Black", 118, color, x0 + 230, y + 230, a * p)
    text(f, "за 1M токенов", "Medium", 36, GREY, x0 + 230, y + 335, a * p)


def s_prices(f, t, a):
    price_card(f, 60, "ВХОД", "$0.10", CORAL, prog(t, 8.2, 0.5), a)
    price_card(f, 560, "ВЫХОД", "$0.50", CORAL, prog(t, 9.6, 0.5), a)
    text(f, "при промпте до 100K токенов", "SemiBold", 44, WHITE, W / 2, CY + 290, a * prog(t, 10.3))


def s_compare(f, t, a):
    text(f, "цена входа за 1M токенов", "SemiBold", 44, GREY, W / 2, CY - 360, a * prog(t, 11.2))
    full = 820
    p1 = prog(t, 11.4, 0.6)
    rrect(f, (130, CY - 240, 130 + full * p1, CY - 150), 24, fill=DIM, alpha=a)
    text(f, "Haiku 4.5", "Bold", 44, GREY, 130, CY - 290, a * p1, anchor="l")
    text(f, "$1.00", "Black", 56, WHITE, 950, CY - 290, a * p1)
    shrink = prog(t, 12.6, 0.8)
    w2 = full - (full - full * 0.1) * shrink
    rrect(f, (130, CY - 40, 130 + w2 * prog(t, 11.8, 0.5), CY + 50), 24, fill=CORAL, alpha=a)
    text(f, "Haiku 5.5", "Bold", 44, CORAL, 130, CY - 90, a * prog(t, 11.8), anchor="l")
    text(f, "$0.10", "Black", 56, CORAL, 950, CY - 90, a * shrink)
    p = prog(t, 12.2, 0.5)
    text(f, "×10", "Black", 220, WHITE, W / 2, CY + 250, a * p, 0.7 + 0.3 * p)
    text(f, "дешевле за токен", "Bold", 60, WHITE, W / 2, CY + 400, a * p)


def s_dialog(f, t, a):
    text(f, "Типичный диалог", "Black", 96, WHITE, W / 2, CY - 300, a * prog(t, 15.9))
    items = [(17.1, "10 сообщений"), (18.25, "системный промпт"), (19.3, "база знаний")]
    for i, (st, s) in enumerate(items):
        p = prog(t, st)
        y = CY - 100 + i * 170
        rrect(f, (140 - (1 - p) * 60, y - 65, 940, y + 65), 34, fill=(26, 26, 36), alpha=a * p)
        check_icon(f, 220, y, 34, GREEN, a * p)
        text(f, s, "Bold", 60, WHITE, 290, y, a * p, anchor="l")


def token_tile(f, cx, big, label, color, p, a):
    y = CY - 60 + (1 - p) * 80
    rrect(f, (cx - 190, y - 210, cx + 190, y + 210), 44, fill=(26, 26, 36), outline=color, width=4, alpha=a * p)
    text(f, big, "Black", 150, color, cx, y - 20, a * p)
    text(f, label, "Bold", 46, GREY, cx, y + 130, a * p)


def s_tokens(f, t, a):
    text(f, "токенов за диалог", "SemiBold", 48, GREY, W / 2, CY - 380, a * prog(t, 20.2))
    token_tile(f, 265, "50K", "вход", CORAL, prog(t, 20.6), a)
    text(f, "+", "Black", 120, WHITE, W / 2, CY - 70, a * prog(t, 22.2))
    token_tile(f, 815, "2K", "выход", CORAL, prog(t, 22.35), a)


def s_cost(f, t, a):
    text(f, "один диалог стоит", "SemiBold", 52, GREY, W / 2, CY - 360, a * prog(t, 23.8))
    c = clamp((t - 24.3) / 1.3)
    val = 0.006 * ease(c)
    move = prog(t, 26.6, 0.5)
    text(f, f"${val:.3f}", "Black", 180, WHITE, W / 2, CY - 190 - 30 * move, a * prog(t, 24.0), 1 - 0.35 * move)
    p = prog(t, 26.8, 0.45)
    text(f, "≈ 3 ₸", "Black", 300, GREEN, W / 2, CY + 110, a * p, 0.6 + 0.4 * p)
    text(f, "за весь диалог", "Bold", 56, WHITE, W / 2, CY + 330, a * prog(t, 27.6))


def s_scale(f, t, a):
    text(f, "1 000 клиентов", "Black", 110, WHITE, W / 2, CY - 260, a * prog(t, 28.6))
    text(f, "в месяц", "Bold", 60, GREY, W / 2, CY - 140, a * prog(t, 29.5))
    p = prog(t, 30.3, 0.45)
    text(f, "≈ $6", "Black", 300, GREEN, W / 2, CY + 140, a * p, 0.6 + 0.4 * p)


def s_context(f, t, a):
    p = prog(t, 31.6, 0.5)
    text(f, "1M", "Black", 380, CORAL, W / 2, CY - 120, a * p, 0.7 + 0.3 * p)
    text(f, "токенов контекста", "Bold", 64, WHITE, W / 2, CY + 140, a * prog(t, 32.4))
    q = prog(t, 34.0)
    rrect(f, (W / 2 - 290, CY + 250, W / 2 + 290, CY + 350), 50, fill=(*CORAL, 40), outline=CORAL, width=3, alpha=a * q)
    text(f, "впервые у Haiku", "SemiBold", 48, WHITE, W / 2, CY + 300, a * q)


def s_effort(f, t, a):
    text(f, "уровни effort", "Black", 110, WHITE, W / 2, CY - 300, a * prog(t, 35.4))
    levels = ["low", "medium", "high", "xhigh", "max"]
    x0, seg, gap = 90, 168, 12
    sel = 0 if t < 39.2 else 2
    for i, name in enumerate(levels):
        p = prog(t, 35.6 + i * 0.12)
        x = x0 + i * (seg + gap)
        on = (t > 37.8 and i == sel)
        fill = CORAL if on else (26, 26, 36)
        rrect(f, (x, CY - 60, x + seg, CY + 60), 28, fill=fill, outline=CORAL if on else DIM, width=3, alpha=a * p)
        text(f, name, "Bold", 40, BG if on else WHITE, x + seg / 2, CY, a * p)
    p1 = prog(t, 37.8)
    text(f, "простые вопросы → low", "Bold", 54, WHITE, W / 2, CY + 190, a * p1)
    p2 = prog(t, 39.2)
    text(f, "сложные → high", "Bold", 54, CORAL, W / 2, CY + 290, a * p2)


def s_trap(f, t, a):
    p = prog(t, 39.95, 0.25)
    shake = math.sin(t * 60) * 14 * clamp(1 - (t - 39.95) / 0.6)
    rrect(f, (0, 0, W, H), 0, fill=(255, 40, 40, 38), alpha=a * p)
    text(f, "ПОДВОХ", "Black", 220, RED, W / 2 + shake, CY, a * p, 0.6 + 0.4 * p)


def s_threshold(f, t, a):
    rrect(f, (0, 0, W, H), 0, fill=(255, 40, 40, 14), alpha=a)
    text(f, "промпт больше 100K токенов", "Bold", 54, WHITE, W / 2, CY - 460, a * prog(t, 41.4))
    x0, x1, y = 90, 990, CY - 200
    mid = (x0 + x1) / 2
    rrect(f, (x0, y - 34, x1, y + 34), 34, fill=(26, 26, 36), alpha=a * prog(t, 41.4))
    fill = clamp((t - 41.8) / 2.0)
    xf = x0 + (x1 - x0) * ease(fill)
    if xf > x0 + 40:
        rrect(f, (x0, y - 34, min(xf, mid), y + 34), 34, fill=GREEN, alpha=a)
    if xf > mid:
        rrect(f, (mid - 30, y - 34, xf, y + 34), 34, fill=RED, alpha=a)
    rrect(f, (mid - 4, y - 70, mid + 4, y + 70), 4, fill=WHITE, alpha=a * prog(t, 41.6))
    text(f, "100K", "Black", 48, WHITE, mid, y - 110, a * prog(t, 41.6))
    pl = prog(t, 42.4)
    text(f, "$0.10 / $0.50", "Black", 64, GREEN, 270, y + 140, a * pl)
    text(f, "до 100K", "SemiBold", 40, GREY, 270, y + 210, a * pl)
    pr = prog(t, 44.8)
    text(f, "$0.50 / $2.50", "Black", 64, RED, 810, y + 140, a * pr)
    text(f, "после 100K", "SemiBold", 40, GREY, 810, y + 210, a * pr)
    p = prog(t, 44.0, 0.3)
    text(f, "×5", "Black", 360, RED, W / 2, CY + 330, a * p, 1.6 - 0.6 * p)


def s_blowup(f, t, a):
    rrect(f, (0, 0, W, H), 0, fill=(255, 40, 40, 14), alpha=a)
    text(f, "вся база + длинная история", "Bold", 54, WHITE, W / 2, CY - 380, a * prog(t, 48.7))
    text(f, "= в каждом запросе", "SemiBold", 46, GREY, W / 2, CY - 300, a * prog(t, 50.3))
    p = prog(t, 51.5)
    text(f, "3 ₸", "Black", 200, GREEN, W / 2, CY - 100, a * p * (1 - 0.6 * prog(t, 52.4)))
    s = prog(t, 52.4, 0.3)
    if s > 0:
        rrect(f, (W / 2 - 200, CY - 108, W / 2 - 200 + 400 * s, CY - 92), 8, fill=RED, alpha=a)
    q = prog(t, 53.1, 0.35)
    text(f, "~300 ₸", "Black", 240, RED, W / 2, CY + 170, a * q, 0.6 + 0.4 * q)
    text(f, "за диалог", "Bold", 52, WHITE, W / 2, CY + 330, a * q)


def s_tips(f, t, a):
    text(f, "держи промпт", "Bold", 64, WHITE, W / 2, CY - 360, a * prog(t, 53.9))
    p = prog(t, 54.9, 0.4)
    text(f, "< 100K", "Black", 220, GREEN, W / 2, CY - 180, a * p, 0.7 + 0.3 * p)
    tips = [(56.1, "1", "режь историю"), (57.1, "2", "из базы — только нужное")]
    for i, (st, n, s) in enumerate(tips):
        q = prog(t, st)
        y = CY + 60 + i * 170
        rrect(f, (110, y - 65, 970, y + 65), 34, fill=(26, 26, 36), alpha=a * q)
        rrect(f, (150, y - 36, 222, y + 36), 36, fill=GREEN, alpha=a * q)
        text(f, n, "Black", 44, BG, 186, y, a * q)
        text(f, s, "Bold", 54, WHITE, 260, y, a * q, anchor="l")


def s_cta(f, t, a):
    text(f, "Напиши в комментариях", "Bold", 64, WHITE, W / 2, CY - 260, a * prog(t, 59.2))
    p = prog(t, 60.2, 0.4)
    pulse = 1 + 0.04 * math.sin(t * 6)
    w, h = 640, 220
    sc = (0.7 + 0.3 * p) * pulse
    rrect(f, (W / 2 - w * sc / 2, CY - h * sc / 2, W / 2 + w * sc / 2, CY + h * sc / 2), int(110 * sc), fill=CORAL, alpha=a * p)
    text(f, "ХАЙКУ", "Black", 150, WHITE, W / 2, CY, a * p, sc)
    text(f, "пришлю расчёт", "Bold", 56, WHITE, W / 2, CY + 240, a * prog(t, 61.2))
    text(f, "и схему агента", "Bold", 56, GREY, W / 2, CY + 320, a * prog(t, 62.1))


SCENES = [
    (0.0, 3.2, s_hook), (3.2, 7.3, s_title), (7.3, 11.1, s_prices),
    (11.1, 15.8, s_compare), (15.8, 20.1, s_dialog), (20.1, 23.7, s_tokens),
    (23.7, 28.5, s_cost), (28.5, 31.5, s_scale), (31.5, 35.3, s_context),
    (35.3, 39.9, s_effort), (39.9, 41.3, s_trap), (41.3, 48.6, s_threshold),
    (48.6, 53.8, s_blowup), (53.8, 59.1, s_tips), (59.1, DUR, s_cta),
]


# ---------- captions (from subtitles.srt) ----------

def load_srt(path):
    out = []
    blocks = open(path, encoding="utf-8").read().strip().split("\n\n")
    to_s = lambda s: int(s[:2]) * 3600 + int(s[3:5]) * 60 + float(s[6:].replace(",", "."))
    for b in blocks:
        lines = b.splitlines()
        st, en = lines[1].split(" --> ")
        out.append((to_s(st), to_s(en), lines[2:]))
    return out


def captions(f, t, subs):
    for st, en, lines in subs:
        if st - 0.05 <= t <= en + 0.25:
            a = prog(t, st - 0.05, 0.15) * (1 - prog(t, en + 0.1, 0.15))
            wrapped = []
            for line in lines:
                if text_layer(line, "Bold", 58, WHITE).width > 960:
                    ws = line.split()
                    k = min(range(1, len(ws)), key=lambda j: max(len(" ".join(ws[:j])), len(" ".join(ws[j:]))))
                    wrapped += [" ".join(ws[:k]), " ".join(ws[k:])]
                else:
                    wrapped.append(line)
            lines = wrapped
            for i, line in enumerate(lines):
                y = 1560 + i * 82 - (len(lines) - 1) * 41
                lay = text_layer(line, "Bold", 58, WHITE)
                rrect(f, (W / 2 - lay.width / 2 - 24, y - 42, W / 2 + lay.width / 2 + 24, y + 42), 20,
                      fill=(0, 0, 0, 150), alpha=a)
                paste(f, lay, W / 2, y, a)
            break


def chrome(f, t):
    text(f, "CLAUDE HAIKU 5.5 · РАЗБОР", "Bold", 34, GREY, W / 2, 150)
    rrect(f, (90, 90, 990, 98), 4, fill=(40, 40, 50))
    rrect(f, (90, 90, 90 + 900 * clamp(t / DUR), 98), 4, fill=CORAL)
    text(f, "@alisovdaniel", "SemiBold", 34, GREY, W / 2, 1830)


def main(out):
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    subs = load_srt(os.path.join(here, "subtitles.srt"))
    bg = make_bg()
    n = int(DUR * FPS)
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
         "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", out],
        stdin=subprocess.PIPE,
    )
    for i in range(n):
        t = i / FPS
        f = bg.copy()
        chrome(f, t)
        for st, en, fn in SCENES:
            if st - 0.01 <= t < en:
                a = 1 - prog(t, en - 0.2, 0.2)
                fn(f, t, a)
        captions(f, t, subs)
        ff.stdin.write(f.convert("RGB").tobytes())
    ff.stdin.close()
    ff.wait()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "haiku55_silent.mp4")
