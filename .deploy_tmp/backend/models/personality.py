from datetime import datetime
from pydantic import BaseModel
from typing import List, Literal

Domain = Literal["ANALYTICAL", "FOCUS_PRESSURE", "COMMUNICATION", "INNOVATION_CHANGE"]
TraitLevel = Literal["LOW", "AVERAGE", "HIGH"]

class TraitScore(BaseModel):
    trait: str
    domain: Domain
    score: float  # 1.0..5.0
    level: TraitLevel

class DevelopmentArea(BaseModel):
    trait: str
    description: str
    suggestions: List[str]

class CareerFitItem(BaseModel):
    description: str

class WorkStyleTip(BaseModel):
    title: str
    description: str

class Reflections(BaseModel):
    strengths: str = ""
    development: str = ""

class PersonalityReport(BaseModel):
    id: str
    user_id: str
    created_at: datetime
    title: str
    trait_scores: List[TraitScore]
    development_areas: List[DevelopmentArea]
    career_fit_thrives: List[CareerFitItem]
    career_fit_challenges: List[CareerFitItem]
    work_style_tips: List[WorkStyleTip]
    reflections: Reflections

class AssessmentAnswer(BaseModel):
    questionId: str
    value: int  # 1..5

class CreateAssessmentRequest(BaseModel):
    answers: List[AssessmentAnswer]

class UpdateReflectionsRequest(BaseModel):
    strengths: str
    development: str

