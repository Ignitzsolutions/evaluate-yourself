from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class TranscriptMessage(BaseModel):
    speaker: str
    text: str
    timestamp: datetime

class ScoreBreakdown(BaseModel):
    communication: int
    clarity: int
    structure: int
    technical_depth: Optional[int] = None
    relevance: int
    eye_contact: Optional[int] = None

class InterviewReport(BaseModel):
    id: str
    user_id: str
    title: str
    date: datetime
    type: str
    mode: str
    duration: str
    overall_score: int
    scores: ScoreBreakdown
    transcript: List[TranscriptMessage]
    recommendations: List[str] = None
    questions: int = 0
    metrics: Optional[dict] = None  # {"total_duration": int, "questions_answered": int, ...}
    ai_feedback: Optional[dict] = None  # AI-generated candidate feedback
    is_sample: bool = False

class InterviewReportSummary(BaseModel):
    id: str
    title: str
    date: datetime
    type: str
    mode: str
    score: int
    questions: int
    is_sample: bool = False

class CreateInterviewReportRequest(BaseModel):
    session_id: Optional[str] = None
    title: str
    type: str
    mode: str
    duration: str
    overall_score: int
    scores: ScoreBreakdown
    transcript: List[TranscriptMessage]
    recommendations: List[str]
    questions: int

