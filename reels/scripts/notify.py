#!/usr/bin/env python3
"""Шлёт уведомление о готовом ролике в WhatsApp через Green API.

Токен берётся только из окружения. Green API по своей архитектуре кладёт токен
в путь URL — обойти это нельзя, поэтому:
  * отдельный инстанс под нотификации, не основной рабочий номер;
  * ротация токена раз в квартал;
  * в логах и в stdout URL печатается с замаскированным токеном.
"""

import argparse
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from publish import load_dotenv  # noqa: E402

ENDPOINT = "https://api.green-api.com/waInstance{inst}/sendMessage/{token}"
REQUIRED = ("GREEN_API_INSTANCE", "GREEN_API_TOKEN", "GREEN_API_CHAT_ID")


def mask(token):
    return f"{token[:4]}…{token[-4:]}" if len(token) > 10 else "…"


def send(text, chat_id=None):
    missing = [k for k in REQUIRED if not os.environ.get(k)]
    if missing:
        raise SystemExit(
            "нет переменных окружения: " + ", ".join(missing) +
            "\nзаполни .env по образцу .env.example (chmod 600)"
        )

    inst = os.environ["GREEN_API_INSTANCE"]
    token = os.environ["GREEN_API_TOKEN"]
    chat = chat_id or os.environ["GREEN_API_CHAT_ID"]

    print(f"POST https://api.green-api.com/waInstance{inst}/sendMessage/{mask(token)}")
    resp = requests.post(
        ENDPOINT.format(inst=inst, token=token),
        json={"chatId": chat, "message": text},
        timeout=30,
    )
    if resp.status_code >= 400:
        raise SystemExit(f"Green API вернул {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def compose(spec_id, url, duration, fps, shots):
    return (
        f"Ролик собран: {spec_id}\n"
        f"{shots} планов · {duration:.2f}с · {fps} fps\n"
        f"{url}"
    )


def main():
    ap = argparse.ArgumentParser(description="Уведомление в WhatsApp")
    ap.add_argument("--text", default=None, help="готовый текст сообщения")
    ap.add_argument("--spec-id", default=None)
    ap.add_argument("--url", default=None)
    ap.add_argument("--duration", type=float, default=0.0)
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--shots", type=int, default=0)
    ap.add_argument("--chat-id", default=None)
    args = ap.parse_args()

    load_dotenv()
    text = args.text or compose(args.spec_id, args.url, args.duration, args.fps, args.shots)
    res = send(text, args.chat_id)
    print("отправлено, idMessage:", res.get("idMessage"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
