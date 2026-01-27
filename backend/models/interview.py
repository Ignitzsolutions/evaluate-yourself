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
    recommendations: List[str]
    questions: int
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

