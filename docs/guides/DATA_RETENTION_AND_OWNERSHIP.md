# Data Retention and Ownership Map

This app stores interview coaching data that can include PII, resumes, transcripts, gaze telemetry, report evidence, and optional baseline-capture metadata. Treat these tables as user-owned data, not anonymous analytics.

## Retention Defaults

| Data | Tables / Fields | Default Policy |
| --- | --- | --- |
| Account identity | `users`, `auth_identities`, `user_emails`, `user_phones` | Retain while account is active. Soft-delete account rows before irreversible deletion. |
| Profile and onboarding | `user_profiles`, `candidate_profiles`, `candidate_profile_versions` | Retain while account is active. Delete or redact resume text, resume drafts, JD text, and baseline metadata on account deletion/export request. |
| Resume/JD inputs | `candidate_profiles.resume_text`, `resume_draft_json`, `target_job_description`, `target_job_url` | User-provided career data. Do not reuse outside coaching/report generation. Delete with profile data. |
| Interview sessions | `interview_sessions`, `interview_rounds`, `session_memory_snapshots` | Retain for report continuity. Remove or anonymize with account deletion. |
| Reports and transcripts | `interview_reports.scores`, `transcript`, `metrics`, `ai_feedback`, `recommendations` | Retain for dashboard/history until the user or admin deletes the account/report. |
| Capture/evidence data | `evidence_artifacts`, `interview_gaze_events` | Treat as biometric-adjacent telemetry. Retain only as long as needed for report replay/audit; delete with report/account deletion. |
| Trial/admin operations | `trial_codes`, `user_entitlements`, `admin_export_jobs`, `auth_audit_events`, `llm_usage_events` | Keep operational/audit records according to business/legal requirements; avoid storing raw transcript/resume data in exports unless explicitly requested. |

## Ownership Keys

| Ownership Key | Tables | Join Rule |
| --- | --- | --- |
| `users.id` | `candidate_profiles`, `candidate_profile_versions`, `interview_reports`, `admin_export_jobs`, `auth_identities`, `user_emails`, `user_phones`, `refresh_tokens`, `auth_audit_events.user_id`, `llm_usage_events.user_id` | Use for canonical account-owned data and self-hosted auth joins. |
| `users.clerk_user_id` | `user_profiles`, `interview_sessions`, `interview_gaze_events`, `interview_rounds`, `session_memory_snapshots`, `trial_codes.redeemed_by_clerk_user_id`, `user_entitlements.clerk_user_id`, `llm_usage_events.clerk_user_id` | Use for legacy interview/session/admin surfaces. Resolve from `users` before joining to canonical `user_id` tables. |
| `session_id` | `interview_sessions`, `interview_reports`, `interview_rounds`, `session_memory_snapshots`, `evidence_artifacts`, `interview_gaze_events` | Use only after checking the owning user key for the table being queried. |

## Deletion Rules

- Account soft-delete must set `users.is_deleted=true`, `deleted_at`, revoke active entitlements/sessions, and block login.
- Account hard-delete/export workflows must include both `users.id` and `clerk_user_id` keyed tables.
- Report deletion must include linked transcript/report metrics, gaze events, evidence artifacts, and replay data.
- Admin exports must expire and should not include raw resume, transcript, gaze, or baseline fields unless the export type explicitly says so.

## Realtime State Policy

- Production realtime/session state requires Redis. In-process fallback is development-only.
- `REDIS_URL` must be configured in production.
- If Redis cannot persist or load runtime session state in production, fail the request instead of silently continuing with partial state.
