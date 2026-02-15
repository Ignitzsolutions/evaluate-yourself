"""Turn-level evaluator for adaptive interview routing.

Uses LangChain structured output when available; falls back to local heuristics.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional

try:
    from services.interview_evaluator import evaluate_response
except Exception:  # pragma: no cover
    from backend.services.interview_evaluator import evaluate_response

try:
    from pydantic import BaseModel, Field
except Exception:  # pragma: no cover
    BaseModel = object  # type: ignore
    Field = lambda *args, **kwargs: None  # type: ignore

try:
    from langchain_openai import ChatOpenAI, AzureChatOpenAI
    from langchain_core.messages import HumanMessage

    LANGCHAIN_AVAILABLE = True
except Exception:  # pragma: no cover
    LANGCHAIN_AVAILABLE = False


class TurnEvaluation(BaseModel):
    """Structured scoring output for one candidate turn."""

    clarity: int = Field(ge=1, le=5)
    depth: int = Field(ge=1, le=5)
    relevance: int = Field(ge=1, le=5)
    confidence: str = Field(pattern="^(low|med|high)$")
    star_completeness: Dict[str, bool] = Field(default_factory=dict)
    technical_correctness: Optional[str] = Field(default=None)
    rationale: str = Field(default="")


def _get_langchain_client():
    if not LANGCHAIN_AVAILABLE:
        return None

    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")

    try:
        if azure_key and azure_endpoint and azure_key != "your-azure-openai-api-key-here":
            deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT") or os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
            return AzureChatOpenAI(
                api_key=azure_key,
                azure_endpoint=azure_endpoint.rstrip("/"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
                deployment_name=deployment,
                temperature=0,
                max_tokens=500,
            )

        if openai_key and openai_key != "your-openai-api-key-here":
            return ChatOpenAI(
                api_key=openai_key,
                model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
                temperature=0,
                max_tokens=500,
            )
    except Exception:
        return None

    return None


def _structured_prompt(
    user_turn: str,
    interview_type: str,
    difficulty: str,
    role: Optional[str],
    company: Optional[str],
    recent_context: str,
) -> str:
    return f"""You are evaluating a single candidate response in a mock interview.
Return strict JSON matching this schema:
{{
  "clarity": 1-5,
  "depth": 1-5,
  "relevance": 1-5,
  "confidence": "low|med|high",
  "star_completeness": {{"situation": bool, "task": bool, "action": bool, "result": bool}},
  "technical_correctness": "low|med|high|null",
  "rationale": "short explanation"
}}

Rules:
- Score only the candidate turn.
- Be strict on relevance and depth.
- Use STAR completeness only for behavioral/mixed context.
- For non-technical context, technical_correctness can be null.
- Keep rationale concise.

Interview type: {interview_type}
Difficulty: {difficulty}
Target role: {role or "not specified"}
Target company: {company or "not specified"}
Recent transcript context:
{recent_context}

Candidate turn:
{user_turn}
"""


def _coerce_eval(raw: Dict[str, Any], interview_type: str) -> Dict[str, Any]:
    def clamp_score(v: Any) -> int:
        try:
            return max(1, min(5, int(v)))
        except Exception:
            return 3

    confidence = str(raw.get("confidence", "med")).lower().strip()
    if confidence not in {"low", "med", "high"}:
        confidence = "med"

    technical = raw.get("technical_correctness")
    technical_val = str(technical).lower().strip() if technical is not None else None
    if technical_val not in {"low", "med", "high"}:
        technical_val = None

    star = raw.get("star_completeness")
    if not isinstance(star, dict):
        star = {}

    if interview_type not in {"behavioral", "mixed"}:
        star = {}

    return {
        "clarity": clamp_score(raw.get("clarity", 3)),
        "depth": clamp_score(raw.get("depth", 3)),
        "relevance": clamp_score(raw.get("relevance", 3)),
        "confidence": confidence,
        "star_completeness": {
            "situation": bool(star.get("situation", False)),
            "task": bool(star.get("task", False)),
            "action": bool(star.get("action", False)),
            "result": bool(star.get("result", False)),
        },
        "technical_correctness": technical_val,
        "rationale": str(raw.get("rationale", ""))[:300],
    }


def _evaluate_with_langchain(
    user_turn: str,
    interview_type: str,
    difficulty: str,
    role: Optional[str],
    company: Optional[str],
    recent_context: str,
) -> Optional[Dict[str, Any]]:
    llm = _get_langchain_client()
    if not llm or not LANGCHAIN_AVAILABLE:
        return None

    prompt = _structured_prompt(
        user_turn=user_turn,
        interview_type=interview_type,
        difficulty=difficulty,
        role=role,
        company=company,
        recent_context=recent_context,
    )

    try:
        structured_llm = llm.with_structured_output(TurnEvaluation)
        result: TurnEvaluation = structured_llm.invoke([HumanMessage(content=prompt)])
        return _coerce_eval(result.model_dump(), interview_type)
    except Exception:
        # Fallback to plain invocation + JSON extraction if structured output fails.
        try:
            resp = llm.invoke([HumanMessage(content=prompt)])
            content = getattr(resp, "content", "") or ""
            m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
            if m:
                content = m.group(1)
            return _coerce_eval(json.loads(content), interview_type)
        except Exception:
            return None


def _evaluate_with_heuristics(user_turn: str, interview_type: str) -> Dict[str, Any]:
    legacy = evaluate_response(user_turn, interview_type)
    return {
        "clarity": max(1, min(5, int(legacy.get("clarity_score", 3)))),
        "depth": max(1, min(5, int(legacy.get("depth_score", 3)))),
        "relevance": max(1, min(5, int(legacy.get("relevance_score", 3)))),
        "confidence": str(legacy.get("confidence_signal", "med")).lower(),
        "star_completeness": legacy.get("star_completeness") if isinstance(legacy.get("star_completeness"), dict) else {},
        "technical_correctness": legacy.get("technical_correctness"),
        "rationale": "; ".join(legacy.get("notes", [])[:2]) if isinstance(legacy.get("notes"), list) else "",
    }


def evaluate_turn(
    user_turn: str,
    interview_type: str = "mixed",
    difficulty: str = "mid",
    role: Optional[str] = None,
    company: Optional[str] = None,
    recent_context: str = "",
) -> Dict[str, Any]:
    """Evaluate one candidate turn with deterministic fallback."""
    text = (user_turn or "").strip()
    if not text:
        return {
            "clarity": 1,
            "depth": 1,
            "relevance": 1,
            "confidence": "low",
            "star_completeness": {},
            "technical_correctness": None,
            "rationale": "Empty response",
        }

    evaluated = _evaluate_with_langchain(
        user_turn=text,
        interview_type=interview_type,
        difficulty=difficulty,
        role=role,
        company=company,
        recent_context=recent_context,
    )
    if evaluated:
        return evaluated

    return _evaluate_with_heuristics(text, interview_type)
