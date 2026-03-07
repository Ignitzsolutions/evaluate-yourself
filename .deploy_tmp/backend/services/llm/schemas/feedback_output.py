"""
Structured output schemas for LLM feedback chains.

These Pydantic models define the expected output format for AI-generated feedback,
enabling type-safe validation and compatibility with LangChain's with_structured_output().
"""

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class CategoryScore(BaseModel):
    """Score for a specific evaluation category with evidence and feedback."""
    
    score: int = Field(
        ...,
        ge=0,
        le=10,
        description="Score from 0-10 for this category"
    )
    evidence: str = Field(
        ...,
        min_length=20,
        max_length=500,
        description="Specific evidence from the interview supporting this score"
    )
    feedback: str = Field(
        ...,
        min_length=50,
        max_length=800,
        description="Detailed constructive feedback for this category"
    )
    
    @field_validator('score')
    @classmethod
    def validate_score(cls, v: int) -> int:
        """Ensure score is in valid range."""
        if not 0 <= v <= 10:
            raise ValueError('Score must be between 0 and 10')
        return v


class CandidateFeedback(BaseModel):
    """Complete structured feedback output for interview evaluation."""
    
    overall_summary: str = Field(
        ...,
        min_length=100,
        max_length=600,
        description="2-3 sentence high-level summary of candidate performance"
    )
    
    categories: Dict[str, CategoryScore] = Field(
        ...,
        description="Scores and feedback for each evaluation category"
    )
    
    strengths: List[str] = Field(
        ...,
        min_items=3,
        max_items=6,
        description="3-6 specific strengths demonstrated in the interview"
    )
    
    areas_for_improvement: List[str] = Field(
        ...,
        min_items=3,
        max_items=6,
        description="3-6 constructive areas where candidate can improve"
    )
    
    recommendation: Literal["strong_hire", "hire", "maybe", "no_hire"] = Field(
        ...,
        description="Final hiring recommendation based on performance"
    )
    
    detailed_feedback: Optional[str] = Field(
        None,
        max_length=2000,
        description="Optional long-form detailed feedback"
    )
    
    @field_validator('strengths', 'areas_for_improvement')
    @classmethod
    def validate_list_items(cls, v: List[str]) -> List[str]:
        """Ensure list items are non-empty and reasonably sized."""
        for item in v:
            if not item or len(item) < 10:
                raise ValueError('List items must be at least 10 characters')
            if len(item) > 300:
                raise ValueError('List items must be at most 300 characters')
        return v
    
    @field_validator('categories')
    @classmethod
    def validate_categories(cls, v: Dict[str, CategoryScore]) -> Dict[str, CategoryScore]:
        """Ensure required categories are present."""
        required = {'communication', 'technical_knowledge', 'problem_solving', 'cultural_fit'}
        missing = required - set(v.keys())
        if missing:
            raise ValueError(f'Missing required categories: {missing}')
        return v
    
    def to_legacy_format(self) -> dict:
        """Convert to legacy format for backward compatibility with existing code."""
        return {
            "overall_summary": self.overall_summary,
            "strengths": self.strengths,
            "areas_for_improvement": self.areas_for_improvement,
            "communication_feedback": self.categories.get("communication", CategoryScore(
                score=5, evidence="N/A", feedback="N/A"
            )).feedback,
            "content_feedback": " ".join([
                cat.feedback for name, cat in self.categories.items()
                if name in ["technical_knowledge", "problem_solving"]
            ]),
            "tips_for_next_interview": self.areas_for_improvement[:4]
        }
    
    def to_report_format(self) -> dict:
        """Convert to format expected by ReportPage frontend."""
        return {
            "overall_score": int(sum(cat.score for cat in self.categories.values()) / len(self.categories) * 10),
            "categories": {
                name: {
                    "score": cat.score,
                    "feedback": cat.feedback
                }
                for name, cat in self.categories.items()
            },
            "strengths": self.strengths,
            "areas_for_improvement": self.areas_for_improvement,
            "detailed_feedback": self.detailed_feedback or self.overall_summary,
            "recommendation": self.recommendation
        }


class TranscriptSummary(BaseModel):
    """Structured output for transcript summarization chain."""
    
    accent: str = Field(
        ...,
        min_length=50,
        max_length=400,
        description="2-4 sentences on accent clarity and comprehensibility"
    )
    
    grammar: str = Field(
        ...,
        min_length=50,
        max_length=400,
        description="2-4 sentences on grammar accuracy and complexity"
    )
    
    fluency: str = Field(
        ...,
        min_length=50,
        max_length=400,
        description="2-4 sentences on speaking fluency and pace"
    )
    
    vocabulary: str = Field(
        ...,
        min_length=50,
        max_length=400,
        description="2-4 sentences on vocabulary range and appropriateness"
    )
    
    interview_tips: List[str] = Field(
        ...,
        min_items=3,
        max_items=5,
        description="3-5 actionable tips for improvement"
    )
    
    @field_validator('interview_tips')
    @classmethod
    def validate_tips(cls, v: List[str]) -> List[str]:
        """Ensure tips are actionable and properly formatted."""
        for tip in v:
            if not tip or len(tip) < 15:
                raise ValueError('Tips must be at least 15 characters')
            if len(tip) > 200:
                raise ValueError('Tips must be at most 200 characters')
        return v
