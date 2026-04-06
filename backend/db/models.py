# backend/db/models.py
import uuid
from sqlalchemy import Column, String, DateTime, Integer, Boolean, Text
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, index=True)
    phone_e164 = Column(String, unique=True, index=True, nullable=True)
    full_name = Column(String)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login_at = Column(DateTime(timezone=True), onupdate=func.now())


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    user_category = Column(String, nullable=False)  # student | professional

    # Common fields
    primary_goal = Column(String, nullable=False)
    target_roles = Column(Text)  # JSON list
    industries = Column(Text)  # JSON list
    interview_timeline = Column(String, nullable=False)
    prep_intensity = Column(String, nullable=False)
    learning_style = Column(String, nullable=False)
    consent_data_use = Column(Boolean, nullable=False, default=False)

    # Student-specific fields
    education_level = Column(String)
    graduation_timeline = Column(String)
    major_domain = Column(String)
    placement_readiness = Column(String)

    # Professional-specific fields
    current_role = Column(String)
    experience_band = Column(String)
    management_scope = Column(String)
    domain_expertise = Column(Text)  # JSON list
    target_company_type = Column(String)
    career_transition_intent = Column(String)
    notice_period_band = Column(String)
    career_comp_band = Column(String)  # Foundation | Growth | Advanced | Leadership
    interview_urgency = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, unique=True, index=True, nullable=False)
    clerk_user_id = Column(String, index=True, nullable=False)
    status = Column(String, nullable=False, default="ACTIVE")  # ACTIVE | COMPLETED | FAILED

    interview_type = Column(String)
    difficulty = Column(String)
    duration_minutes_requested = Column(Integer)
    duration_minutes_effective = Column(Integer)

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    report_id = Column(String, index=True, nullable=True)
    session_meta_json = Column(Text)  # JSON object

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class InterviewReport(Base):
    __tablename__ = "interview_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, unique=True, index=True, nullable=True)  # Session ID from interview
    user_id = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    type = Column(String, nullable=False)  # behavioral, technical, mixed
    mode = Column(String, nullable=False)  # Voice-Only Realtime, Full Interview, etc.
    duration = Column(String)  # "20 minutes"
    overall_score = Column(Integer, default=0)  # 0-100
    
    # Store as JSON strings
    scores = Column(Text)  # JSON: {communication, clarity, structure, technical_depth, relevance}
    transcript = Column(Text)  # JSON: Array of {speaker, text, timestamp}
    recommendations = Column(Text)  # JSON: Array of recommendation strings
    questions = Column(Integer, default=0)  # Number of questions asked
    
    metrics = Column(Text)  # JSON: {total_duration, questions_answered, total_words, speaking_time, silence_time, eye_contact_pct, ...}
    ai_feedback = Column(Text)  # JSON: AI-generated candidate feedback

    def set_metrics(self, metrics_dict):
        import json
        self.metrics = json.dumps(metrics_dict)

    def get_metrics(self):
        import json
        if self.metrics:
            return json.loads(self.metrics)
        return {}
    is_sample = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class LaunchWaitlistSignup(Base):
    __tablename__ = "launch_waitlist_signups"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, nullable=False)
    normalized_email = Column(String, unique=True, index=True, nullable=False)
    source_page = Column(String, nullable=False, default="landing")
    intent = Column(String, nullable=False, default="free_trial")
    status = Column(String, nullable=False, default="ACTIVE")
    meta_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TrialFeedback(Base):
    __tablename__ = "trial_feedback"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=True)
    clerk_user_id = Column(String, index=True, nullable=True)
    report_id = Column(String, unique=True, index=True, nullable=False)
    session_id = Column(String, index=True, nullable=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    plan_tier = Column(String, nullable=True)
    trial_mode = Column(Boolean, nullable=False, default=True)
    source = Column(String, nullable=False, default="post_trial_report")
    submitted_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class InterviewGazeEvent(Base):
    __tablename__ = "interview_gaze_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, index=True, nullable=False)
    clerk_user_id = Column(String, index=True, nullable=False)
    event_type = Column(String, index=True, nullable=False)
    description = Column(String, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=False)
    duration_ms = Column(Integer, nullable=False)
    confidence = Column(Integer, nullable=True)  # 0-100
    source = Column(String, nullable=False, default="opencv_haar_v1")
    extra_json = Column(Text, nullable=True)  # JSON object
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TrialCode(Base):
    __tablename__ = "trial_codes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=True)
    code_suffix = Column(String, index=True, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE")  # ACTIVE|REDEEMED|REVOKED|EXPIRED|DELETED
    duration_minutes = Column(Integer, nullable=False, default=5)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_by_clerk_user_id = Column(String, nullable=False)
    redeemed_by_clerk_user_id = Column(String, nullable=True, index=True)
    redeemed_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    meta_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UserEntitlement(Base):
    __tablename__ = "user_entitlements"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    clerk_user_id = Column(String, index=True, nullable=False)
    source_type = Column(String, nullable=False, default="TRIAL_CODE")
    source_id = Column(String, nullable=False, index=True)
    plan_tier = Column(String, nullable=False, default="trial")
    duration_minutes_effective = Column(Integer, nullable=False, default=5)
    is_active = Column(Boolean, nullable=False, default=True)
    starts_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AuthIdentity(Base):
    __tablename__ = "auth_identities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    provider = Column(String, index=True, nullable=False, default="clerk")
    provider_user_id = Column(String, index=True, nullable=False)
    provider_instance = Column(String, nullable=True)
    external_id = Column(String, nullable=True, index=True)
    legacy_provider_user_id = Column(String, nullable=True, index=True)
    is_primary = Column(Boolean, nullable=False, default=True)
    raw_claims_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UserEmail(Base):
    __tablename__ = "user_emails"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    email = Column(String, nullable=False)
    normalized_email = Column(String, unique=True, index=True, nullable=False)
    is_primary = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    source = Column(String, nullable=False, default="clerk")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class UserPhone(Base):
    __tablename__ = "user_phones"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    phone_e164 = Column(String, unique=True, index=True, nullable=False)
    is_primary = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    country_code = Column(String, nullable=True)
    source = Column(String, nullable=False, default="clerk")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CandidateProfileV2(Base):
    __tablename__ = "candidate_profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, unique=True, index=True, nullable=False)
    full_name_override = Column(String, nullable=True)
    candidate_type = Column(String, nullable=False, default="student")
    state_code = Column(String, nullable=True)
    city = Column(String, nullable=True)
    country_code = Column(String, nullable=False, default="IN")
    university_name = Column(String, nullable=True)
    university_normalized = Column(String, nullable=True)
    university_id = Column(String, nullable=True)
    degree_level = Column(String, nullable=True)
    degree_name = Column(String, nullable=True)
    branch_specialization = Column(String, nullable=True)
    graduation_year = Column(Integer, nullable=True)
    current_year_of_study = Column(String, nullable=True)
    experience_level = Column(String, nullable=True)
    primary_stream = Column(String, nullable=True, index=True)
    target_roles_json = Column(Text, nullable=False, default="[]")
    target_companies_json = Column(Text, nullable=False, default="[]")
    skills_self_reported_json = Column(Text, nullable=False, default="[]")
    resume_url = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    github_url = Column(String, nullable=True)
    consent_data_use = Column(Boolean, nullable=False, default=False)
    consent_contact = Column(Boolean, nullable=False, default=False)
    profile_completion_score = Column(Integer, nullable=False, default=0)
    profile_completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class CandidateProfileVersion(Base):
    __tablename__ = "candidate_profile_versions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True, nullable=False)
    version_no = Column(Integer, nullable=False, default=1)
    snapshot_json = Column(Text, nullable=False, default="{}")
    source = Column(String, nullable=False, default="onboarding_submit")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AdminExportJob(Base):
    __tablename__ = "admin_export_jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_by_user_id = Column(String, index=True, nullable=False)
    export_type = Column(String, index=True, nullable=False)
    filters_json = Column(Text, nullable=True)
    columns_json = Column(Text, nullable=True)
    status = Column(String, index=True, nullable=False, default="queued")
    row_count = Column(Integer, nullable=True)
    file_storage_kind = Column(String, nullable=False, default="db_blob")
    file_url = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    mime_type = Column(String, nullable=True, default="text/csv")
    file_content_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AdminSkillTrack(Base):
    __tablename__ = "admin_skill_tracks"

    id = Column(String, primary_key=True)  # system track id for overrides, slug id for custom
    track_type = Column(String, index=True, nullable=False)  # technical | behavioral
    source_kind = Column(String, nullable=False)  # system_override | custom
    label = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by_clerk_user_id = Column(String, nullable=True)
    updated_by_clerk_user_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AdminQuestionOverride(Base):
    __tablename__ = "admin_question_overrides"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    builtin_question_id = Column(String, unique=True, index=True, nullable=False)
    override_text = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=True)  # None means no status override
    updated_by_clerk_user_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AdminCustomQuestion(Base):
    __tablename__ = "admin_custom_questions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    track_id = Column(String, index=True, nullable=False)
    track_type = Column(String, index=True, nullable=False)  # technical | behavioral
    text = Column(Text, nullable=False)
    difficulty_scope = Column(String, nullable=False, default="all")
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=True)
    created_by_clerk_user_id = Column(String, nullable=True)
    updated_by_clerk_user_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
