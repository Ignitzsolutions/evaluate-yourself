# Evaluate Yourself API Endpoints (Production Flow)

## Authentication + Profile
- `GET /api/me` - sync/fetch current Clerk user in app DB.
- `GET /api/users/me` - alias for current user data.
- `GET /api/profile/status` - onboarding completion status.
- `GET /api/profile/me` - full onboarding profile.
- `PUT /api/profile/me` - create/update onboarding profile.

## Realtime Interview
- `POST /api/realtime/webrtc` - creates realtime session + SDP answer.
  - Returns:
    - `sdpAnswer`
    - `sessionId`
    - `effectiveDurationMinutes`
    - `trialMode`
    - `planTier`

## Interview Session Persistence
- `GET /api/interview/sessions/{session_id}` - durable session status and metadata.
- `POST /api/interview/{session_id}/transcript` - save transcript + metrics + report generation.

## Reports
- `GET /api/interview/reports` - current user reports list.
- `GET /api/interview/reports/{report_id}` - report details.
- `GET /api/interview/reports/{report_id}/download?format=pdf` - report PDF.

## Ops
- `GET /health` - backend health endpoint.
