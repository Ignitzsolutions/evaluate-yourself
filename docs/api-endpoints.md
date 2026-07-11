# Evaluate Yourself API Inventory

This inventory reflects the current FastAPI application surface as imported locally on `2026-07-02`.

Current totals:

- `80` paths
- `88` HTTP operations

## Core candidate flow

These endpoints are required to sign in, start an interview, persist evidence, and retrieve the report.

### Auth and identity

- `POST /api/auth/sync`
- `POST /api/auth/login`
- `POST /api/auth/login/mfa`
- `POST /api/auth/logout`
- `POST /api/auth/mfa/confirm`
- `POST /api/auth/mfa/disable`
- `POST /api/auth/mfa/enroll`
- `GET /api/auth/mfa/status`
- `POST /api/auth/refresh`
- `POST /api/auth/register`
- `GET /api/auth/sessions`
- `DELETE /api/auth/sessions/{jti}`
- `POST /api/auth/set-password`
- `GET /api/me`
- `POST /api/me/heartbeat`
- `GET /api/users/me`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/profile/me`
- `PUT /api/profile/me`
- `GET /api/profile/status`

### Realtime interview runtime

- `POST /api/realtime/webrtc`
- `POST /api/realtime/sessions`
- `GET /api/interview/skill-catalog`
- `GET /api/interview/sessions/{session_id}`
- `GET /api/interview/sessions/{session_id}/gaze-events`
- `POST /api/interview/{session_id}/capture`
- `POST /api/interview/{session_id}/next-turn`
- `POST /api/interview/{session_id}/transcript`

### Reports and playback

- `GET /api/interview/reports`
- `POST /api/interview/reports`
- `GET /api/interview/reports/{report_id}`
- `GET /api/interview/reports/{report_id}/download`
- `PUT /api/interview/reports/{report_id}/feedback`
- `GET /api/interview/reports/{report_id}/replay`

### Health

- `GET /health`

## Optional product surfaces

These are useful product modules, but they are not required to run the main interview-to-report flow.

### Communication practice

- `GET /api/communication-practice/packs`
- `POST /api/communication-practice/next-prompt`
- `POST /api/communication-practice/evaluate-turn`

### Self-insight

- `POST /api/self-insight/assessments`
- `GET /api/self-insight/reports`
- `GET /api/self-insight/reports/{report_id}`
- `GET /api/self-insight/reports/{report_id}/pdf`
- `PATCH /api/self-insight/reports/{report_id}/reflections`

### Analytics

- `GET /api/analytics/skills`
- `GET /api/analytics/summary`
- `GET /api/analytics/trends`

### Waitlist

- `POST /api/waitlist`

## Admin and operational APIs

Admin surface currently accounts for `39` operations.

### Candidate and interview operations

- `GET /api/admin/active-users`
- `GET /api/admin/candidates`
- `POST /api/admin/candidates/bulk-action`
- `GET /api/admin/candidates/{clerk_user_id}`
- `DELETE /api/admin/candidates/{clerk_user_id}`
- `POST /api/admin/candidates/{clerk_user_id}/deactivate`
- `GET /api/admin/interviews`
- `GET /api/admin/reports`
- `GET /api/admin/summary`

### Dashboard and quality

- `GET /api/admin/dashboard/funnel`
- `GET /api/admin/dashboard/overview`
- `GET /api/admin/dashboard/quality`
- `GET /api/admin/evaluation/quality-summary`

### Exports

- `GET /api/admin/exports`
- `POST /api/admin/exports`
- `GET /api/admin/exports/{export_id}`
- `GET /api/admin/exports/{export_id}/download`

### Live monitoring and tokens

- `GET /api/admin/live/active-users`
- `GET /api/admin/live/stream`
- `GET /api/admin/live/token`
- `GET /api/admin/tokens/summary`
- `GET /api/admin/tokens/timeseries`

### Security

- `GET /api/admin/security/audit`
- `GET /api/admin/security/sessions/{user_id}`
- `DELETE /api/admin/security/sessions/{jti}`
- `POST /api/admin/security/unlock`

### Question bank

- `GET /api/admin/question-bank/questions`
- `POST /api/admin/question-bank/questions`
- `PATCH /api/admin/question-bank/builtin-questions/{builtin_question_id}`
- `PATCH /api/admin/question-bank/custom-questions/{question_id}`
- `GET /api/admin/question-bank/tracks`
- `POST /api/admin/question-bank/tracks`
- `PATCH /api/admin/question-bank/tracks/{track_id}`

### Trial and config operations

- `GET /api/admin/config`
- `GET /api/admin/trials`
- `GET /api/admin/trial-codes`
- `POST /api/admin/trial-codes`
- `POST /api/admin/trial-codes/bulk-delete`
- `DELETE /api/admin/trial-codes/{code_id}`
- `POST /api/trial-codes/redeem`

## Realtime provider capability interfaces

The app should be treated as requiring four external AI capability interfaces, not one monolithic vendor endpoint:

- `Realtime session bootstrap`
  Creates or negotiates the live Sonia session.
- `Streaming transcription`
  Produces partial and final transcript events with timestamps.
- `Turn reasoning`
  Generates next-turn behavior, adaptive questioning, and evaluation/report reasoning.
- `Streaming TTS`
  Produces Sonia audio quickly enough to keep the interview feeling live.

## Recommended provider modes

### OpenAI native

- Realtime session bootstrap: OpenAI Realtime
- Streaming transcription: OpenAI realtime transcription
- Turn reasoning: OpenAI chat/reasoning models
- Streaming TTS: OpenAI realtime audio output

### Sarvam hybrid

- Realtime session bootstrap: backend-managed session plus websocket transport
- Streaming transcription: Sarvam streaming STT
- Turn reasoning: OpenAI chat/reasoning models
- Streaming TTS: Sarvam streaming TTS

See [docs/provider-matrix.md](/Users/srujanreddy/Projects/evaluate-yourself/docs/provider-matrix.md) and [docs/realtime-provider-architecture.md](/Users/srujanreddy/Projects/evaluate-yourself/docs/realtime-provider-architecture.md) for the architecture split.
