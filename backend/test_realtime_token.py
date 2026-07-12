#!/usr/bin/env python3
"""
Test OpenAI-native Realtime client_secrets token creation. Run from project root:
  python backend/test_realtime_token.py

Prints the raw provider response so you can inspect status, headers, and body.
"""

import os
import sys
from pathlib import Path

import requests

backend_dir = Path(__file__).resolve().parent
for env_file in [backend_dir / ".env", backend_dir.parent / ".env"]:
    if env_file.exists():
        try:
            from dotenv import load_dotenv

            load_dotenv(env_file, override=True)
            print(f"Loaded env from {env_file}")
            break
        except ImportError:
            pass


API_BASE = (
    os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1") or "https://api.openai.com/v1"
).rstrip("/")
API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")
MODEL = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview-2024-12-17")
VOICE = os.getenv("REALTIME_VOICE", "alloy")


def main():
    if not API_KEY:
        print("Set OPENAI_API_KEY in backend/.env or project .env")
        sys.exit(1)

    url = f"{API_BASE}/realtime/client_secrets"
    body = {
        "expires_after": {"anchor": "created_at", "seconds": 3600},
        "session": {
            "type": "realtime",
            "model": MODEL,
            "voice": VOICE,
            "input_audio_format": "pcm16",
            "output_modalities": ["audio"],
            "input_audio_transcription": {
                "model": os.getenv("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe"),
                "language": "en",
            },
            "instructions": "You are a helpful assistant.",
        },
    }
    headers = {"Authorization": f"Bearer {API_KEY}", "content-type": "application/json"}
    print(f"Token URL: {url}")
    print(f"Realtime model: {MODEL}")
    print("Requesting...")
    try:
        response = requests.post(url, headers=headers, json=body, timeout=(20, 120))
    except requests.Timeout:
        print("Request timed out.")
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001
        print(f"Request error: {exc}")
        sys.exit(1)

    print(f"\nStatus: {response.status_code}")
    print("Headers:", dict(response.headers))
    print("Body:", response.text[:2000] if response.text else "(empty)")

    if response.status_code == 200:
        data = response.json()
        token = data.get("value", "")
        print(f"\nToken length: {len(token)}")
        sys.exit(0)

    if response.status_code == 404:
        print("\n--- Troubleshooting (404 Not Found) ---")
        print(
            "1. Confirm OPENAI_API_BASE points to a provider that supports /realtime/client_secrets."
        )
        print("2. Confirm OPENAI_REALTIME_MODEL is enabled for your account.")
    elif response.status_code in {401, 403}:
        print("\n--- Troubleshooting (auth) ---")
        print("1. Confirm OPENAI_API_KEY is valid.")
        print("2. Confirm the key has access to the configured realtime model.")
    elif response.status_code == 429:
        print("\n--- Troubleshooting (rate limit) ---")
        print("1. Retry after a short delay.")
        print("2. Check provider usage limits for your account.")

    sys.exit(1)


if __name__ == "__main__":
    main()
