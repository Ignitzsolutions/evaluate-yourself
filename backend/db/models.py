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
    
    is_sample = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
