# Audio Setup Guide

This guide covers the current realtime interview path.

## Quick Start

1. Configure the backend provider credentials in `backend/.env`:

```env
AI_PROVIDER=openai_native
OPENAI_API_KEY=your-key
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
REALTIME_VOICE=alloy
```

2. Start the backend:

```bash
uv sync
uv run uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

3. Start the frontend:

```bash
npm start
```

4. Join an interview, allow mic/camera, and confirm Sonia opens the session.

## Runtime Shape

Current path:

1. Browser captures mic and camera with native APIs.
2. Frontend creates a WebRTC session through `/api/realtime/webrtc`.
3. Backend provisions the provider session and returns bootstrap data.
4. The realtime provider handles server-grade speech transcription and audio response.
5. Browser fallback speech capture remains UX-only and must not be treated as trusted scoring evidence.

## What To Check First

- `AI_PROVIDER` is set correctly.
- `OPENAI_API_KEY` is present when `AI_PROVIDER=openai_native`.
- Browser permissions for microphone and camera are granted.
- `/api/realtime/webrtc` returns a valid session payload.
- Interview page badges move through `Connecting`, `Listening`, `Thinking`, and `Sonia Speaking`.

## Common Failures

### Provider bootstrap fails

- Confirm backend env vars are loaded.
- Run `python backend/test_realtime_token.py`.
- Check backend logs for the exact provider failure.

### Microphone permission denied

- Retry from the interview setup screen.
- Re-grant browser permissions.
- Confirm `getUserMedia` is called from a user gesture path.

### Sonia stalls after a user turn

- Inspect `/api/interview/{session_id}/next-turn`.
- Confirm the UI shows degraded or recovery state instead of silently waiting.
- Check whether the planner returned `recoverable_error` metadata.

### Audio plays but transcript looks wrong

- Treat browser transcript as continuity-only.
- Verify trusted transcript capture on `/api/interview/{session_id}/capture`.

## Production Expectations

- Sonia should introduce herself deterministically.
- User speaking should toggle the listening indicator promptly.
- AI speaking should toggle the speaking indicator promptly.
- Blocked autoplay must not block transcript progression or question count.
