#!/usr/bin/env python3
"""
Test Azure Realtime client_secrets token creation. Run from project root:
  python backend/test_realtime_token.py

Prints the raw Azure response so you can see exact status, headers, and body.
"""
import os
import re
import sys
from pathlib import Path

# Load .env from backend or project root
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

import requests

ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-realtime")
API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-08-28")


def extract_resource_name(endpoint: str) -> str:
    from urllib.parse import urlparse
    parsed = urlparse(endpoint if endpoint.startswith(("http://", "https://")) else f"https://{endpoint}")
    hostname = (parsed.netloc or parsed.path.split("/")[0]).split("/")[0].split("?")[0]
    m = re.match(r"^([^.]+)\.openai\.azure\.com$", hostname)
    if m:
        return m.group(1)
    m = re.match(r"^(.+)\.cognitiveservices\.azure\.com$", hostname)
    if m:
        return m.group(1)
    raise ValueError(f"Unknown hostname: {hostname}")


def main():
    if not ENDPOINT or not API_KEY:
        print("Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in backend/.env")
        sys.exit(1)
    resource_name = extract_resource_name(ENDPOINT)
    base = f"{resource_name}.openai.azure.com"
    url = f"https://{base}/openai/v1/realtime/client_secrets"
    url_with_version = f"{url}?api-version={API_VERSION}"
    body = {
        "expires_after": {"anchor": "created_at", "seconds": 3600},
        "session": {
            "type": "realtime",
            "model": DEPLOYMENT,
            "audio": {"output": {"voice": "alloy"}},
            "instructions": "You are a helpful assistant.",
        },
    }
    headers = {"api-key": API_KEY, "content-type": "application/json"}
    print(f"Token URL (no api-version): {url}")
    print(f"Deployment: {DEPLOYMENT}")
    print("Requesting...")
    try:
        r = requests.post(url, headers=headers, json=body, timeout=(20, 120))
    except requests.Timeout:
        print("Request timed out.")
        sys.exit(1)
    except Exception as e:
        print(f"Request error: {e}")
        sys.exit(1)
    print(f"\nStatus: {r.status_code}")
    print("Headers:", dict(r.headers))
    print("Body:", r.text[:2000] if r.text else "(empty)")
    if r.status_code == 400 and "API version" in (r.text or ""):
        print("\n--- Retrying with api-version in URL ---")
        r2 = requests.post(url_with_version, headers=headers, json=body, timeout=(20, 120))
        print(f"Retry Status: {r2.status_code}")
        print("Retry Body:", r2.text[:2000] if r2.text else "(empty)")
    if r.status_code == 200:
        data = r.json()
        tok = data.get("value", "")
        print(f"\nToken length: {len(tok)}")
        sys.exit(0)
    if r.status_code == 500:
        print("\n--- Troubleshooting (500 Internal Server Error) ---")
        print("1. In Azure Portal / AI Foundry, confirm Realtime API is enabled for this resource.")
        print("2. Confirm AZURE_OPENAI_DEPLOYMENT matches the exact deployment name (e.g. gpt-realtime).")
        print("3. Realtime is available in East US 2 and Sweden Central; your resource is Sweden Central.")
        print("4. If using a multi-service (cognitiveservices.azure.com) resource, ensure it has OpenAI and Realtime model deployments.")
    sys.exit(1)


if __name__ == "__main__":
    main()
