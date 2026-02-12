# backend/db/models.py
import uuid
from sqlalchemy import Column, String, DateTime, Integer, Boolean, Text
from sqlalchemy.dialects.sqlite import BLOB
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, index=True)
    full_name = Column(String)
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
