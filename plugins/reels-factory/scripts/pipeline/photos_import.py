#!/usr/bin/env python3
"""
Готовит фото и видео с iPhone к монтажу. Два режима.

РЕЖИМ 1 — отбор уже сделан через apple-photos-mcp (предпочтительный):
    python3 photos_import.py --from-dir ~/Desktop/trip-export --out raw/trip
    osxphotos не вызывается, скрипт только конвертирует и собирает media.json.

РЕЖИМ 2 — забрать всё за период самому:
    pip3 install osxphotos
    python3 photos_import.py --days 7 --out raw/trip

Отдаёт:
    raw/trip/photos/*.jpg      HEIC сконвертированы
    raw/trip/videos/*.mp4      H.264 1080p — Remotion не жуёт HEVC 4K с телефона
    raw/trip/media.json        дата, место, избранное, длительность
    raw/trip/sheets/*.jpg      контактные листы

ПРИВАТНОСТЬ. Библиотека Photos — вся личная жизнь: скриншоты с кодами, документы,
дети. Режим 2 берёт только диапазон дат и выбрасывает скриншоты. Посмотри,
что отобралось, прежде чем куда-то заливать.
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path
from datetime import datetime, timedelta

PHOTO_EXT = (".jpg", ".jpeg", ".png", ".heic", ".heif")
VIDEO_EXT = (".mov", ".mp4", ".m4v")


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)


def need(binary, hint):
    if not shutil.which(binary):
        sys.exit(f"нет {binary}. {hint}")


def meta_for(stem, items):
    """Метаданные из osxphotos, если они есть. В режиме --from-dir их нет."""
    for i in items:
        if Path(i.get("original_filename", "")).stem in stem:
            pi = i.get("place") or {}
            place = (pi.get("name") or pi.get("address_str")) if isinstance(pi, dict) else None
            return {"date": i.get("date"), "place": place,
                    "favorite": i.get("favorite", False)}
    return {"date": None, "place": None, "favorite": False}


def process(src, out, max_video_sec, items):
    media = []
    for f in sorted(Path(src).rglob("*")):
        if not f.is_file():
            continue
        ext = f.suffix.lower()
        m = meta_for(f.stem, items)

        if ext in PHOTO_EXT:
            dst = out / "photos" / (f.stem + ".jpg")
            if ext in (".heic", ".heif"):
                sh(f'ffmpeg -hide_banner -loglevel error -y -i "{f}" -q:v 2 "{dst}"')
            else:
                shutil.copy(f, dst)
            if dst.exists():
                media.append({"type": "photo", "file": str(dst), **m})

        elif ext in VIDEO_EXT:
            dst = out / "videos" / (f.stem + ".mp4")
            # iPhone пишет HEVC 4K 60fps — Remotion на таком спотыкается
            sh(f'ffmpeg -hide_banner -loglevel error -y -i "{f}" '
               f'-t {max_video_sec} -vf "scale=-2:1080" '
               f'-c:v libx264 -crf 21 -preset veryfast -c:a aac -b:a 128k "{dst}"')
            if dst.exists():
                d = sh(f'ffprobe -v error -show_entries format=duration '
                       f'-of csv=p=0 "{dst}"').stdout.strip()
                media.append({"type": "video", "file": str(dst),
                              "duration": round(float(d), 2) if d else None, **m})
    return media


def sheets(out, media):
    photos = [m for m in media if m["type"] == "photo"]
    for n in range(0, len(photos), 25):
        chunk = photos[n:n + 25]
        lst = out / f"_sheet{n}.txt"
        lst.write_text("\n".join(f"file '{m['file']}'" for m in chunk))
        sh(f'ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i "{lst}" '
           f'-vf "scale=260:-1,tile=5x5" -frames:v 1 "{out}/sheets/sheet-{n // 25}.jpg"')
        lst.unlink(missing_ok=True)
    return len(photos)


def finish(out, media):
    n_photo = sheets(out, media)
    n_video = len([m for m in media if m["type"] == "video"])
    (out / "media.json").write_text(json.dumps({"media": media}, ensure_ascii=False, indent=2))
    print(f"\n✓ {n_photo} фото · {n_video} видео")
    print(f"  {out}/media.json · контактные листы в {out}/sheets/")
    print("  Открой листы и выбери кадры — не собирай вслепую.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-dir", help="папка, куда apple-photos-mcp уже экспортировал отобранное")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--album")
    ap.add_argument("--favorites", action="store_true")
    ap.add_argument("--out", default="raw/trip")
    ap.add_argument("--max-video-sec", type=float, default=20)
    a = ap.parse_args()

    need("ffmpeg", "brew install ffmpeg")
    out = Path(a.out)
    for sub in ("photos", "videos", "sheets"):
        (out / sub).mkdir(parents=True, exist_ok=True)

    # Режим 1: отбор сделан через MCP
    if a.from_dir:
        src = Path(a.from_dir).expanduser()
        if not src.is_dir():
            sys.exit(f"нет папки {src}")
        print(f"→ беру готовый экспорт из {src}")
        finish(out, process(src, out, a.max_video_sec, []))
        return

    # Режим 2: забираем сами через osxphotos
    need("osxphotos", "pip3 install osxphotos")
    since = (datetime.now() - timedelta(days=a.days)).strftime("%Y-%m-%d")

    q = [f"osxphotos query --from-date {since}", "--not-screenshot", "--json"]
    if a.album:
        q.append(f'--album "{a.album}"')
    if a.favorites:
        q.append("--favorite")

    print(f"→ читаю библиотеку Photos с {since}")
    r = sh(" ".join(q))
    if r.returncode != 0:
        sys.exit(f"osxphotos: {r.stderr[-600:]}")
    try:
        items = json.loads(r.stdout or "[]")
    except json.JSONDecodeError:
        sys.exit("osxphotos вернул не JSON — проверь Full Disk Access")
    print(f"  найдено {len(items)}")

    raw = out / "_raw"
    exp = [f'osxphotos export "{raw}" --from-date {since}',
           "--not-screenshot --download-missing --convert-to-jpeg --jpeg-quality 0.92",
           "--skip-original-if-edited"]
    if a.album:
        exp.append(f'--album "{a.album}"')
    if a.favorites:
        exp.append("--favorite")

    print("→ экспортирую (iCloud-снимки скачаются, это займёт время)")
    r = sh(" ".join(exp))
    if r.returncode != 0:
        print(f"  предупреждение: {r.stderr[-400:]}")

    finish(out, process(raw, out, a.max_video_sec, items))
    shutil.rmtree(raw, ignore_errors=True)


if __name__ == "__main__":
    main()
