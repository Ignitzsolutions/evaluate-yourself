# Realtime Troubleshooting

If the interview fails at startup, use this checklist.

## 1. Run the token test

From the project root:

```bash
python backend/test_realtime_token.py
```

This validates the current provider token/bootstrap path.

Typical outcomes:

- `200`: provider bootstrap is reachable
- `401` or `403`: invalid key or missing model access
- `404`: wrong provider base URL or unsupported realtime endpoint
- `429`: provider rate limit
- `5xx`: provider-side failure or malformed request contract

## 2. Verify environment

For `AI_PROVIDER=openai_native`:

```env
OPENAI_API_KEY=...
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
REALTIME_VOICE=alloy
```

For `AI_PROVIDER=sarvam_hybrid`, the current backend intentionally returns a not-implemented path until the gateway is built.

## 3. Check the interview bootstrap route

Verify:

- `POST /api/realtime/webrtc` succeeds
- the response includes the expected session bootstrap fields
- the frontend sends one canonical `session.update`

## 4. Check planner continuity

If Sonia opens but does not continue:

- inspect `/api/interview/{session_id}/next-turn`
- look for `recoverable_error` or degraded planner metadata
- verify the client shows recovery state instead of stalling silently

## 5. Check trusted evidence capture

If transcripts or scoring look inconsistent:

- inspect `/api/interview/{session_id}/capture`
- verify trusted server transcript artifacts exist
- confirm fallback browser transcript is not being used as authoritative scoring evidence
