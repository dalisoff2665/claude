#!/usr/bin/env python3
"""
Заливает готовый ролик в Cloudinary и пишет ссылку в CONTENT PLAN.

    export CLOUDINARY_URL=cloudinary://<key>:<secret>@dm30hfevr
    export AIRTABLE_PAT=...
    python3 scripts/publish.py out/reel.mp4 --record recXXXXXXXXXXXXXX

Оба секрета — из окружения. В Airtable уходит только URL, не ключи.
"""
import argparse, json, os, sys, urllib.request

def upload(path, folder):
    try:
        import cloudinary, cloudinary.uploader
    except ImportError:
        sys.exit("pip3 install cloudinary")
    if not os.environ.get("CLOUDINARY_URL"):
        sys.exit("нет CLOUDINARY_URL в окружении")
    cloudinary.config(secure=True)
    r = cloudinary.uploader.upload_large(
        path, resource_type="video", folder=folder,
        chunk_size=6_000_000, eager_async=True,
    )
    return r["secure_url"], r["public_id"], round(r.get("duration", 0), 2)

def airtable_patch(base, table, rec, fields):
    pat = os.environ.get("AIRTABLE_PAT")
    if not pat:
        sys.exit("нет AIRTABLE_PAT")
    req = urllib.request.Request(
        f"https://api.airtable.com/v0/{base}/{table}/{rec}",
        data=json.dumps({"fields": fields}).encode(),
        headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--record", help="recID в CONTENT PLAN")
    ap.add_argument("--folder", default="REELS_READY")
    ap.add_argument("--base", default=os.environ.get("AIRTABLE_BASE", "appspFv4OyALMTk8K"))
    ap.add_argument("--table", default="tblSppKHHKEDnyIoN")
    a = ap.parse_args()

    url, pid, dur = upload(a.video, a.folder)
    print(f"✓ Cloudinary: {url}")

    if a.record:
        airtable_patch(a.base, a.table, a.record, {
            "Cloudinary": url,
            "Cloudinary ID": pid,
            "Продолжительность": dur,
            "Монтаж готов?": True,
        })
        print(f"✓ Airtable {a.record} обновлён")

if __name__ == "__main__":
    main()
