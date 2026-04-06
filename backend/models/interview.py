from pydantic import BaseModel
from typing import Dict, List, Optional
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

class StarBreakdown(BaseModel):
    situation: bool = False
    task: bool = False
    action: bool = False
    result: bool = False
    situation_snippet: Optional[str] = None
    task_snippet: Optional[str] = None
    action_snippet: Optional[str] = None
    result_snippet: Optional[str] = None
    source: str = "keyword_fallback"

class TurnAnalysis(BaseModel):
    turn_id: int
    question_text: str
    competency: str
    score_0_100: int
    star_breakdown: Optional[StarBreakdown] = None
    evidence_quote: Optional[str] = None
    one_line_feedback: Optional[str] = None
    depth_signals: Optional[dict] = None

class ImprovementItem(BaseModel):
    competency: str
    finding: str
    suggested_action: str
    example_reframe: Optional[str] = None

class HiringRecommendation(BaseModel):
    signal: str  # strong_hire | hire | borderline | no_hire
    label: str
    rationale_bullets: List[str]
    red_flags: List[str] = []
    green_flags: List[str] = []

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
    metrics: Optional[dict] = None
    ai_feedback: Optional[dict] = None
    is_sample: bool = False
    # v2 fields
    competency_scores: Optional[Dict[str, int]] = None
    score_context: Optional[str] = None
    turn_analyses: Optional[List[TurnAnalysis]] = None
    improvement_roadmap: Optional[List[ImprovementItem]] = None
    hiring_recommendation: Optional[HiringRecommendation] = None

class InterviewReportSummary(BaseModel):
    id: str
    title: str
    date: datetime
    type: str
    mode: str
    score: int
    questions: int
    is_sample: bool = False
    hiring_signal: Optional[str] = None

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

