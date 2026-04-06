"""Dynamic LLM-based follow-up question generator.

Replaces hardcoded follow-up templates in adaptive_engine.py with
context-aware follow-up questions generated from the candidate's actual answer.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

try:
    from services.interview.llm_cache import get as cache_get, put as cache_put
except Exception:
    try:
        from backend.services.interview.llm_cache import get as cache_get, put as cache_put
    except Exception:
        cache_get = lambda *a: None  # type: ignore
        cache_put = lambda *a: None  # type: ignore


# ─── Hardcoded template fallbacks (from original adaptive_engine) ─────────────

_FOLLOWUP_TEMPLATES: Dict[str, List[str]] = {
    "behavioral": [
        "Can you walk me through the specific steps you took in that situation?",
        "What was the outcome, and how did you measure success?",
        "Looking back, what would you do differently?",
        "How did that experience influence how you approach similar situations today?",
    ],
    "technical": [
        "Can you go deeper on the technical implementation?",
        "What were the key trade-offs you considered?",
        "How did you handle edge cases or failure scenarios?",
        "What would you change if you were designing this from scratch?",
    ],
    "mixed": [
        "Can you give a concrete example from your experience?",
        "What was the specific impact or outcome?",
        "How did you involve others in that decision?",
        "What constraints were you working within?",
    ],
    "star_missing_result": [
        "What was the final outcome of that effort?",
        "How did you measure the success of that work?",
        "Did that effort achieve the goal you were aiming for?",
    ],
    "star_missing_action": [
        "What specific steps did you personally take to address that?",
        "Walk me through what you actually did.",
    ],
    "depth_low": [
        "Can you give me a more specific example?",
        "What was your direct contribution there?",
        "Tell me more about the technical details.",
    ],
    "relevance_low": [
        "I want to make sure I understand — how does that relate to [the question]?",
        "Can you bring that back to the specific situation I asked about?",
    ],
}


# ─── LLM client ───────────────────────────────────────────────────────────────

def _get_llm_client():
    try:
        from openai import AzureOpenAI, OpenAI
    except ImportError:
        return None, None

    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")

    if azure_key and azure_endpoint and azure_key != "your-azure-openai-api-key-here":
        deployment = (os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "") or "").strip()
        if not deployment:
            return None, None
        try:
            return AzureOpenAI(
                api_key=azure_key,
                azure_endpoint=azure_endpoint.rstrip("/"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
            ), deployment
        except Exception:
            return None, None

    if openai_key and openai_key != "your-openai-api-key-here":
        try:
            return OpenAI(api_key=openai_key), os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
        except Exception:
            return None, None

    return None, None


_FOLLOWUP_PROMPT = """\
You are an expert technical interviewer. Generate ONE concise follow-up question.

Context:
- Interview question: {question}
- Candidate's answer: {answer_snippet}
- Probe target: {probe_reason}
- Interview type: {interview_type}

Rules:
- The follow-up must be specific to what the candidate said (reference their words/context)
- Maximum 30 words
- Do not use filler like "That's interesting" or "Great answer"
- Return ONLY the question text, nothing else
"""


def _llm_followup(
    question: str,
    answer_snippet: str,
    probe_reason: str,
    interview_type: str,
    client: Any,
    model: str,
) -> Optional[str]:
    prompt = _FOLLOWUP_PROMPT.format(
        question=question[:200],
        answer_snippet=answer_snippet[:300],
        probe_reason=probe_reason,
        interview_type=interview_type,
    )
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=60,
            temperature=0.3,
        )
        followup = (response.choices[0].message.content or "").strip()
        # Strip quotes if LLM wrapped in them
        followup = followup.strip('"').strip("'")
        # Sanity: must look like a question and be reasonable length
        if len(followup) < 10 or len(followup) > 200:
            return None
        return followup
    except Exception:
        return None


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_followup(
    question: str,
    answer: str,
    probe_reason: str = "depth_low",
    interview_type: str = "mixed",
    question_id: Optional[str] = None,
) -> str:
    """Generate a context-aware follow-up question.

    Args:
        question: The original interview question asked.
        answer: The candidate's full answer text.
        probe_reason: Why we're following up. One of:
            'star_missing_result', 'star_missing_action', 'star_missing_task',
            'depth_low', 'relevance_low', 'behavioral', 'technical', 'mixed'
        interview_type: 'behavioral' | 'technical' | 'mixed'
        question_id: Optional question ID for cache key.

    Returns:
        A follow-up question string (never empty).
    """
    answer_snippet = (answer or "")[:400].strip()
    cache_key = (question_id or question[:100], answer_snippet[:200], probe_reason)

    cached = cache_get("followup", *cache_key)
    if cached is not None:
        return cached

    client, model = _get_llm_client()
    if client and model:
        followup = _llm_followup(
            question=question,
            answer_snippet=answer_snippet,
            probe_reason=probe_reason.replace("_", " "),
            interview_type=interview_type,
            client=client,
            model=model,
        )
        if followup:
            cache_put("followup", followup, *cache_key)
            return followup

    # Template fallback
    templates = (
        _FOLLOWUP_TEMPLATES.get(probe_reason)
        or _FOLLOWUP_TEMPLATES.get(interview_type)
        or _FOLLOWUP_TEMPLATES["mixed"]
    )
    # Use a stable index based on answer length to vary templates without randomness
    idx = len(answer_snippet) % len(templates)
    result = templates[idx]
    cache_put("followup", result, *cache_key)
    return result
