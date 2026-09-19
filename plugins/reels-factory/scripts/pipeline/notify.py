#!/usr/bin/env python3
"""
Отправляет готовый ролик в WhatsApp через Green API.

    python3 notify.py --video <cloudinary-url> --record recXXX --title "..."

ПОЛУЧАТЕЛЬ ЗАШИТ В ОКРУЖЕНИЕ, не приходит из данных и не выбирается моделью.
Это единственная защита от того, что инъекция в чужом заголовке превратится
в рассылку по твоим клиентам.
"""
import argparse, json, os, sys, urllib.request

ID = os.environ.get("GREENAPI_ID")
TOKEN = os.environ.get("GREENAPI_TOKEN")
CHAT = os.environ.get("REELS_NOTIFY_CHAT")      # 7XXXXXXXXXX@c.us — твой номер
APPROVE = os.environ.get("APPROVE_BASE", "https://clony.agent-cleaner.com/approve")

def send(method, payload):
    url = f"https://api.green-api.com/waInstance{ID}/{method}/{TOKEN}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--record", required=True)
    ap.add_argument("--title", default="")
    ap.add_argument("--duration", default="")
    a = ap.parse_args()
    for k, v in (("GREENAPI_ID", ID), ("GREENAPI_TOKEN", TOKEN), ("REELS_NOTIFY_CHAT", CHAT)):
        if not v:
            sys.exit(f"нет {k} в окружении")

    caption = (f"Готов ролик\n{a.title}\n"
               f"{a.duration}\n\n"
               f"Одобрить / переделать / искать ещё:\n{APPROVE}?rec={a.record}")

    r = send("sendFileByUrl", {
        "chatId": CHAT, "urlFile": a.video,
        "fileName": "reel.mp4", "caption": caption,
    })
    print("✓ отправлено:", r.get("idMessage", r))

if __name__ == "__main__":
    main()
