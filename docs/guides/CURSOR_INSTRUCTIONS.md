# Cursor Instructions

## Core Principle

This project uses native browser media APIs on the client and a backend-managed realtime provider session.

Do not add:

- third-party WebRTC wrappers
- client-side PCM/base64 audio pipelines
- browser-side provider secrets
- websocket proxy layers that duplicate the existing backend contract

## Frontend Expectations

Rely on:

- `RTCPeerConnection`
- `navigator.mediaDevices.getUserMedia`
- browser media playback
- the existing interview runtime hooks and state machine

## Backend Expectations

Rely on:

- FastAPI for HTTP surfaces
- provider session bootstrap through the backend
- provider-neutral configuration through `AI_PROVIDER`

Current provider mode:

```env
AI_PROVIDER=openai_native
OPENAI_API_KEY=...
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
```

Reserved future mode:

```env
AI_PROVIDER=sarvam_hybrid
SARVAM_API_KEY=...
```

## Guardrails

- Browser transcript fallback is UX-only.
- Trusted evaluation evidence must come from server-side capture and transcription paths.
- Keep the interview runtime deterministic: one session contract, one opening turn, explicit degraded-state handling.
