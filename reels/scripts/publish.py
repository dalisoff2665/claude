#!/usr/bin/env python3
"""Заливает готовый ролик в Cloudinary подписанным upload'ом.

Ключи только из окружения (.env, chmod 600). В аргументы, логи и URL они не попадают:
подпись считается локально, секрет уходит в тело POST-запроса по TLS.
"""

import argparse
import hashlib
import os
import sys
import time
from pathlib import Path

import requests

API = "https://api.cloudinary.com/v1_1/{cloud}/video/upload"
REQUIRED = ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")


def load_dotenv(path=None):
    path = Path(path or Path(__file__).resolve().parent.parent.parent / ".env")
    if not path.exists():
        return
    mode = path.stat().st_mode & 0o077
    if mode:
        print(f"  WARN  {path} читается кем-то ещё — сделай chmod 600", file=sys.stderr)
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def sign(params, secret):
    """Cloudinary: sha1 от отсортированных params + api_secret."""
    payload = "&".join(f"{k}={params[k]}" for k in sorted(params) if params[k] != "")
    return hashlib.sha1((payload + secret).encode("utf-8")).hexdigest()


def upload(video, public_id, folder, tags):
    missing = [k for k in REQUIRED if not os.environ.get(k)]
    if missing:
        raise SystemExit(
            "нет переменных окружения: " + ", ".join(missing) +
            "\nзаполни .env по образцу .env.example (chmod 600)"
        )

    cloud = os.environ["CLOUDINARY_CLOUD_NAME"]
    secret = os.environ["CLOUDINARY_API_SECRET"]

    signed = {
        "timestamp": str(int(time.time())),
        "public_id": public_id,
        "folder": folder,
        "tags": ",".join(tags),
    }
    form = dict(signed)
    form["api_key"] = os.environ["CLOUDINARY_API_KEY"]
    form["signature"] = sign(signed, secret)

    with open(video, "rb") as fh:
        resp = requests.post(
            API.format(cloud=cloud),
            data=form,
            files={"file": (Path(video).name, fh, "video/mp4")},
            timeout=300,
        )

    if resp.status_code >= 400:
        raise SystemExit(f"Cloudinary вернул {resp.status_code}: {resp.text[:400]}")
    return resp.json()


def main():
    ap = argparse.ArgumentParser(description="Публикация ролика в Cloudinary")
    ap.add_argument("video")
    ap.add_argument("--public-id", default=None)
    ap.add_argument("--folder", default="reels")
    ap.add_argument("--tag", action="append", default=[], dest="tags")
    args = ap.parse_args()

    load_dotenv()
    video = Path(args.video)
    if not video.exists():
        raise SystemExit(f"файл не найден: {video}")

    public_id = args.public_id or video.stem
    res = upload(video, public_id, args.folder, args.tags or ["reels-factory"])

    print(f"public_id : {res['public_id']}")
    print(f"формат    : {res.get('format')} {res.get('width')}x{res.get('height')} "
          f"{res.get('duration')}с")
    print(f"url       : {res['secure_url']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
