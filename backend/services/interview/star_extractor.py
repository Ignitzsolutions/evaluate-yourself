"""LLM-backed STAR component extractor.

Replaces keyword-matching STAR detection with a small LLM call that extracts
actual text segments for Situation, Task, Action, and Result from a candidate
answer.  Falls back to the existing keyword heuristics if the LLM call fails.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional

try:
    from services.interview.llm_cache import get as cache_get, put as cache_put
except Exception:
    try:
        from backend.services.interview.llm_cache import get as cache_get, put as cache_put
    except Exception:
        cache_get = lambda *a: None  # type: ignore
        cache_put = lambda *a: None  # type: ignore

# ─── Keyword fallback (original heuristics) ───────────────────────────────────

_STAR_SITUATION = {
    "situation", "context", "background", "project", "company", "role",
    "team", "working", "was working", "at the time",
}
_STAR_TASK = {
    "task", "goal", "objective", "needed", "responsible", "assigned",
    "challenge", "problem", "issue",
}
_STAR_ACTION = {
    "i did", "i took", "i built", "i led", "i implemented", "i designed",
    "i created", "i worked", "i wrote", "i fixed", "i decided", "i started",
    "i reached out", "i proposed", "i set up", "i developed", "i coordinated",
}
_STAR_RESULT = {
    "result", "outcome", "impact", "improved", "reduced", "increased",
    "achieved", "delivered", "shipped", "saved", "success", "learned",
    "led to", "this resulted", "as a result", "ultimately",
}

_STAR_SETS = {
    "situation": _STAR_SITUATION,
    "task": _STAR_TASK,
    "action": _STAR_ACTION,
    "result": _STAR_RESULT,
}


def _keyword_star(answer: str) -> Dict[str, Any]:
    lowered = (answer or "").lower()
    result: Dict[str, Any] = {}
    for component, phrases in _STAR_SETS.items():
        detected = any(phrase in lowered for phrase in phrases)
        result[component] = {"detected": detected, "snippet": None}
    return result


# ─── LLM client helper ────────────────────────────────────────────────────────

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
        client = AzureOpenAI(
            api_key=azure_key,
            azure_endpoint=azure_endpoint.rstrip("/"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
        )
        return client, deployment

    if openai_key and openai_key != "your-openai-api-key-here":
        client = OpenAI(api_key=openai_key)
        return client, os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")

    return None, None


_EXTRACTION_PROMPT = """\
You are an expert interview coach. Extract STAR components from the candidate's answer below.

For each STAR component (Situation, Task, Action, Result), determine:
- "detected": true/false — was this component present?
- "snippet": the exact short excerpt (max 60 words) from the answer that represents this component, or null if not found.

Return ONLY a JSON object in this exact format, nothing else:
{
  "situation": {"detected": bool, "snippet": str|null},
  "task":      {"detected": bool, "snippet": str|null},
  "action":    {"detected": bool, "snippet": str|null},
  "result":    {"detected": bool, "snippet": str|null}
}

Candidate's answer:
\"\"\"
{answer}
\"\"\"
"""


def _llm_star(answer: str, client: Any, model: str) -> Optional[Dict[str, Any]]:
    """Call LLM to extract STAR components. Returns parsed dict or None on failure."""
    prompt = _EXTRACTION_PROMPT.format(answer=answer[:1500])
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0,
        )
        raw = (response.choices[0].message.content or "").strip()
        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)
        # Validate shape
        expected = {"situation", "task", "action", "result"}
        if not expected.issubset(parsed.keys()):
            return None
        for comp in expected:
            if not isinstance(parsed[comp], dict):
                return None
            if "detected" not in parsed[comp]:
                return None
        return parsed
    except Exception:
        return None


def _clean_snippet(snippet: Optional[str], answer: str) -> Optional[str]:
    """Ensure snippet is actually from the answer and reasonably short."""
    if not snippet:
        return None
    snippet = snippet.strip()
    # If LLM hallucinated something not in the answer, discard
    if snippet.lower() not in answer.lower() and len(snippet) > 20:
        return None
    return snippet[:200] if len(snippet) > 200 else snippet


# ─── Public API ───────────────────────────────────────────────────────────────

def extract_star(answer: str) -> Dict[str, Any]:
    """Extract STAR components from a candidate answer.

    Returns:
        Dict with keys 'situation', 'task', 'action', 'result'.
        Each value is {'detected': bool, 'snippet': str|null}.
        Also includes 'source': 'llm' | 'keyword_fallback'.
    """
    if not answer or not answer.strip():
        return {
            "situation": {"detected": False, "snippet": None},
            "task":      {"detected": False, "snippet": None},
            "action":    {"detected": False, "snippet": None},
            "result":    {"detected": False, "snippet": None},
            "source":    "keyword_fallback",
        }

    answer_stripped = answer.strip()

    # Check cache
    cached = cache_get("star", answer_stripped[:500])
    if cached is not None:
        return cached

    # Try LLM extraction first
    client, model = _get_llm_client()
    if client and model:
        result = _llm_star(answer_stripped, client, model)
        if result:
            for comp in ("situation", "task", "action", "result"):
                result[comp]["snippet"] = _clean_snippet(
                    result[comp].get("snippet"), answer_stripped
                )
            result["source"] = "llm"
            cache_put("star", result, answer_stripped[:500])
            return result

    # Keyword fallback
    result = _keyword_star(answer_stripped)
    result["source"] = "keyword_fallback"
    cache_put("star", result, answer_stripped[:500])
    return result


def star_score_0_100(star_result: Dict[str, Any]) -> int:
    """Convert STAR extraction result to a 0-100 structure score."""
    components = ("situation", "task", "action", "result")
    detected = sum(
        1 for c in components
        if star_result.get(c, {}).get("detected", False)
    )
    return int(round(detected / 4 * 100))


def star_to_legacy_bool(star_result: Dict[str, Any]) -> Dict[str, bool]:
    """Convert extract_star output to legacy {situation: bool, ...} format."""
    return {
        comp: bool(star_result.get(comp, {}).get("detected", False))
        for comp in ("situation", "task", "action", "result")
    }
