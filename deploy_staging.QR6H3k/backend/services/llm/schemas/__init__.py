"""
LLM Chain Output Schemas

Pydantic models for structured LLM chain outputs.
Enables type-safe validation and LangChain with_structured_output() support.
"""

from .feedback_output import (
    CategoryScore,
    CandidateFeedback,
    TranscriptSummary
)

__all__ = [
    "CategoryScore",
    "CandidateFeedback",
    "TranscriptSummary"
]
