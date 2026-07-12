# Compatibility Guide

This project now targets a provider-neutral self-hosted runtime.

## Supported Runtime

- Python: `3.11`
- Node.js: `18+`
- OS: Linux for CI and server deployment
- Database: PostgreSQL in production, SQLite allowed for local fallback
- Cache/Event store: Redis optional but recommended for live interview state

## Python Tooling

The Python source of truth is:

- `pyproject.toml`
- `uv.lock`
- root `requirements.txt` as a temporary compatibility export

Preferred commands:

```bash
uv sync
uv run uvicorn backend.app:app --host 0.0.0.0 --port 8000
uv run pytest
uv run black --check backend
uv run mypy
```

## System Packages

The backend may require these Linux packages when OpenCV and scientific wheels are used:

```bash
sudo apt-get update
sudo apt-get install -y \
  libopenblas-dev \
  libgl1 \
  libglib2.0-0 \
  libavcodec-dev \
  libavformat-dev \
  libswscale-dev
```

## Realtime Provider Configuration

The app no longer assumes Azure-specific configuration.

Primary supported mode today:

```env
AI_PROVIDER=openai_native
OPENAI_API_KEY=your-key
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
REALTIME_VOICE=alloy
```

Reserved migration mode:

```env
AI_PROVIDER=sarvam_hybrid
SARVAM_API_KEY=your-key
SARVAM_STT_WS_URL=wss://...
SARVAM_TTS_WS_URL=wss://...
```

`sarvam_hybrid` is intentionally blocked at runtime until the gateway implementation is added.

## Deployment Model

Production deployment is now SSH/server based rather than App Service based.

- CI builds and verifies the repo
- release artifact is uploaded over SSH
- remote host runs `docker compose up -d --build`
- post-deploy smoke checks validate the app surface

Required deployment secrets are documented in [README.md](/Users/srujanreddy/Projects/evaluate-yourself/README.md).

## Notes

- Do not place provider secrets in frontend code.
- Archived Azure-era guides remain in historical materials only; they are not the active deployment path.
