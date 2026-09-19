#!/usr/bin/env python3
"""
Аватар HeyGen на однотонном фоне — резервный путь, когда своего дубля нет.
Форма кадра (кружок, сплит, вырез) задаётся рендером, здесь только говорящая голова.

    python3 heygen.py --text "текст сценария" --out raw/aroll.mp4
"""
import argparse, json, os, sys, time, urllib.request

KEY = os.environ.get("HEYGEN_API_KEY")
AVATAR = os.environ.get("HEYGEN_AVATAR_ID")
VOICE = os.environ.get("HEYGEN_VOICE_ID")

def api(path, payload=None, method="POST"):
    req = urllib.request.Request(
        f"https://api.heygen.com{path}",
        data=json.dumps(payload).encode() if payload else None,
        method=method,
        headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", default="raw/aroll.mp4")
    ap.add_argument("--bg", default="#00FF00", help="однотонный фон под chroma key")
    ap.add_argument("--timeout", type=int, default=900)
    a = ap.parse_args()
    for k, v in (("HEYGEN_API_KEY", KEY), ("HEYGEN_AVATAR_ID", AVATAR), ("HEYGEN_VOICE_ID", VOICE)):
        if not v:
            sys.exit(f"нет {k}")

    r = api("/v2/video/generate", {
        "video_inputs": [{
            "character": {"type": "avatar", "avatar_id": AVATAR, "avatar_style": "normal"},
            "voice": {"type": "text", "input_text": a.text, "voice_id": VOICE},
            "background": {"type": "color", "value": a.bg},
        }],
        "dimension": {"width": 1080, "height": 1920},
    })
    vid = r["data"]["video_id"]
    print(f"→ задание {vid}, жду рендер")

    deadline = time.time() + a.timeout
    while time.time() < deadline:
        time.sleep(15)
        st = api(f"/v1/video_status.get?video_id={vid}", method="GET")["data"]
        if st["status"] == "completed":
            os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
            urllib.request.urlretrieve(st["video_url"], a.out)
            print(f"✓ {a.out}")
            return
        if st["status"] == "failed":
            sys.exit(f"HeyGen: {st.get('error')}")
        print(f"  {st['status']}…")
    sys.exit("таймаут ожидания HeyGen")

if __name__ == "__main__":
    main()
