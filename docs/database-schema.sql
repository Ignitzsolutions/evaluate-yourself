-- Evaluate Yourself: Current Database Schema
-- Source of truth: backend/db/models.py + Alembic migrations up to 20260223_0004
-- Notes:
-- 1) This is PostgreSQL-friendly SQL.
-- 2) Current app uses logical relations (clerk_user_id/session_id) rather than strict FK constraints.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  email TEXT,
  phone_e164 TEXT,
  full_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_clerk_user_id ON users (clerk_user_id);
CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone_e164 ON users (phone_e164);


CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  user_category TEXT NOT NULL,
  primary_goal TEXT NOT NULL,
  target_roles TEXT,
  industries TEXT,
  interview_timeline TEXT NOT NULL,
  prep_intensity TEXT NOT NULL,
  learning_style TEXT NOT NULL,
  consent_data_use BOOLEAN NOT NULL DEFAULT FALSE,
  education_level TEXT,
  graduation_timeline TEXT,
  major_domain TEXT,
  placement_readiness TEXT,
  current_role TEXT,
  experience_band TEXT,
  management_scope TEXT,
  domain_expertise TEXT,
  target_company_type TEXT,
  career_transition_intent TEXT,
  notice_period_band TEXT,
  career_comp_band TEXT,
  interview_urgency TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_profiles_clerk_user_id ON user_profiles (clerk_user_id);


CREATE TABLE IF NOT EXISTS interview_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  interview_type TEXT,
  difficulty TEXT,
  duration_minutes_requested INTEGER,
  duration_minutes_effective INTEGER,
  started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ,
  report_id TEXT,
  session_meta_json TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_interview_sessions_session_id ON interview_sessions (session_id);
CREATE INDEX IF NOT EXISTS ix_interview_sessions_clerk_user_id ON interview_sessions (clerk_user_id);
CREATE INDEX IF NOT EXISTS ix_interview_sessions_report_id ON interview_sessions (report_id);


CREATE TABLE IF NOT EXISTS interview_reports (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL,
  mode TEXT NOT NULL,
  duration TEXT,
  overall_score INTEGER DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  scores TEXT,
  transcript TEXT,
  recommendations TEXT,
  questions INTEGER DEFAULT 0,
  metrics TEXT,
  ai_feedback TEXT,
  is_sample BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_interview_reports_session_id ON interview_reports (session_id);
CREATE INDEX IF NOT EXISTS ix_interview_reports_user_id ON interview_reports (user_id);


CREATE TABLE IF NOT EXISTS trial_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  duration_minutes INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by_clerk_user_id TEXT NOT NULL,
  redeemed_by_clerk_user_id TEXT,
  redeemed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  meta_json TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_trial_codes_code ON trial_codes (code);
CREATE INDEX IF NOT EXISTS ix_trial_codes_redeemed_by_clerk_user_id ON trial_codes (redeemed_by_clerk_user_id);


CREATE TABLE IF NOT EXISTS user_entitlements (
  id TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'TRIAL_CODE',
  source_id TEXT NOT NULL,
  plan_tier TEXT NOT NULL DEFAULT 'trial',
  duration_minutes_effective INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_user_entitlements_clerk_user_id ON user_entitlements (clerk_user_id);
CREATE INDEX IF NOT EXISTS ix_user_entitlements_source_id ON user_entitlements (source_id);
CREATE INDEX IF NOT EXISTS ix_user_entitlements_user_source_active
  ON user_entitlements (clerk_user_id, source_type, source_id, is_active);


CREATE TABLE IF NOT EXISTS interview_gaze_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER NOT NULL,
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  source TEXT NOT NULL DEFAULT 'opencv_haar_v1',
  extra_json TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_interview_gaze_events_session_id ON interview_gaze_events (session_id);
CREATE INDEX IF NOT EXISTS ix_interview_gaze_events_clerk_user_id ON interview_gaze_events (clerk_user_id);
CREATE INDEX IF NOT EXISTS ix_interview_gaze_events_event_type ON interview_gaze_events (event_type);
CREATE INDEX IF NOT EXISTS ix_interview_gaze_events_session_started ON interview_gaze_events (session_id, started_at);

COMMIT;

