# Setup Guide - Evaluate Yourself

Complete setup instructions for the provider-neutral realtime interview stack.

> For editor-specific package constraints, see [CURSOR_INSTRUCTIONS.md](./CURSOR_INSTRUCTIONS.md).

## Prerequisites

- Node.js `18+`
- Python `3.11`
- `uv` for Python environment and dependency management
- A backend `.env` with one supported realtime provider mode configured

## Quick start

### 1. Install dependencies

Frontend:

```bash
npm install
```

Backend:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync
```

### 2. Configure environment

Backend:

```bash
cp backend/.env.example backend/.env
```

Frontend:

```bash
cp .env.example .env
```

## Provider modes

The runtime should be configured in one of these modes:

- `openai_native`
- `sarvam_hybrid`

See [../provider-matrix.md](/Users/srujanreddy/Projects/evaluate-yourself/docs/provider-matrix.md) for the capability split.

## Recommended backend environment contract

### Shared runtime

- `AI_PROVIDER`
- `DATABASE_URL`
- `REDIS_URL`
- `ALLOWED_ORIGINS`
- Clerk auth variables used by the app

### OpenAI native mode

- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `OPENAI_REALTIME_MODEL`

### Sarvam hybrid mode

- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `SARVAM_API_KEY`
- `SARVAM_STT_WS_URL`
- `SARVAM_TTS_WS_URL`

## Frontend environment

- `REACT_APP_API_URL` or `VITE_API_URL`
- optional realtime/UI overrides already supported by the app, such as voice or debug flags

## Run the application

Backend:

```bash
uv run uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
npm start
```

Access points:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

## What the provider must support

The product does not need one vendor-specific endpoint. It needs these capability surfaces:

- realtime session bootstrap
- streaming transcription
- turn reasoning
- streaming TTS

See [../realtime-provider-architecture.md](/Users/srujanreddy/Projects/evaluate-yourself/docs/realtime-provider-architecture.md) for the normalized backend-owned architecture.

## Troubleshooting

### Backend will not start

- run `uv sync`
- confirm `backend/.env` exists
- confirm the selected provider mode has the required credentials

### Interview connection fails

- verify the backend is running
- verify `/health` and `/docs` load
- confirm the active provider mode is correctly configured
- review backend logs for provider bootstrap failures

### Audio fails in browser

- verify browser microphone permissions
- check the browser console and network tab
- confirm the backend realtime bootstrap endpoint is reachable

## Active references

- Provider comparison: [../provider-matrix.md](/Users/srujanreddy/Projects/evaluate-yourself/docs/provider-matrix.md)
- Realtime architecture: [../realtime-provider-architecture.md](/Users/srujanreddy/Projects/evaluate-yourself/docs/realtime-provider-architecture.md)
- API inventory: [../api-endpoints.md](/Users/srujanreddy/Projects/evaluate-yourself/docs/api-endpoints.md)
