"""Semantic relevance scorer for interview answers.

Replaces token-overlap relevance scoring with an LLM judge call.
Falls back to the existing token-overlap heuristic when the LLM is unavailable.
Results are cached per (question, answer) pair to avoid redundant calls.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Optional, Tuple

try:
    from services.interview.llm_cache import get as cache_get, put as cache_put
except Exception:
    try:
        from backend.services.interview.llm_cache import get as cache_get, put as cache_put
    except Exception:
        cache_get = lambda *a: None  # type: ignore
        cache_put = lambda *a: None  # type: ignore

# ─── Token-overlap fallback ───────────────────────────────────────────────────

_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "our",
    "that", "the", "their", "this", "to", "was", "we", "what", "when",
    "where", "which", "who", "why", "with", "you", "your",
}


def _content_tokens(text: str):
    tokens = re.findall(r"[a-z0-9][a-z0-9\-\+#\.]*", (text or "").lower())
    return {t for t in tokens if t not in _STOPWORDS and len(t) > 2}


def _token_overlap_score(question: str, answer: str) -> Tuple[int, str]:
    answer_tokens = _content_tokens(answer)
    if not answer_tokens:
        return 1, "no_candidate_text"
    question_tokens = _content_tokens(question)
    if not question_tokens:
        return (2 if len(answer_tokens) < 8 else 3), "no_question_anchor"
    overlap = question_tokens & answer_tokens
    ratio = len(overlap) / max(len(question_tokens), 1)
    if ratio >= 0.60:
        return 5, f"overlap_ratio={round(ratio, 3)}"
    if ratio >= 0.35:
        return 4, f"overlap_ratio={round(ratio, 3)}"
    if ratio >= 0.15:
        return 3, f"overlap_ratio={round(ratio, 3)}"
    return (1 if len(answer_tokens) < 8 else 2), f"overlap_ratio={round(ratio, 3)}"


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
        try:
            client = AzureOpenAI(
                api_key=azure_key,
                azure_endpoint=azure_endpoint.rstrip("/"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
            )
            return client, deployment
        except Exception:
            return None, None

    if openai_key and openai_key != "your-openai-api-key-here":
        try:
            client = OpenAI(api_key=openai_key)
            return client, os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
        except Exception:
            return None, None

    return None, None


_RELEVANCE_PROMPT = """\
You are an expert interview evaluator. Rate how well the candidate's answer addresses the interview question.

Question: {question}

Candidate's answer: {answer}

Rate the relevance on a scale of 1-5:
1 = Completely off-topic or no answer
2 = Mostly off-topic with minor tangential relevance
3 = Partially relevant — addresses some aspects but misses key points
4 = Mostly relevant — addresses the main question with minor gaps
5 = Fully relevant — directly and completely addresses what was asked

Return ONLY a JSON object, nothing else:
{{"score": <1-5 integer>, "rationale": "<one sentence explanation>"}}
"""


def _llm_relevance(
    question: str, answer: str, client: Any, model: str
) -> Optional[Tuple[int, str]]:
    prompt = _RELEVANCE_PROMPT.format(
        question=question[:400],
        answer=answer[:800],
    )
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=120,
            temperature=0,
        )
        raw = (response.choices[0].message.content or "").strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)
        score = int(parsed["score"])
        score = max(1, min(5, score))
        rationale = str(parsed.get("rationale", "llm_judge"))[:200]
        return score, f"llm_judge: {rationale}"
    except Exception:
        return None


# ─── Public API ───────────────────────────────────────────────────────────────

def score_relevance(question: str, answer: str) -> Tuple[int, str]:
    """Score relevance of an answer to a question on a 1-5 scale.

    Returns:
        (score: int 1-5, reason: str)
        Source is 'llm_judge' when LLM is available, else 'token_overlap'.
    """
    if not question or not answer:
        return 1, "missing_question_or_answer"

    cache_key = (question[:300], answer[:500])
    cached = cache_get("relevance", *cache_key)
    if cached is not None:
        return cached

    client, model = _get_llm_client()
    if client and model:
        result = _llm_relevance(question, answer, client, model)
        if result is not None:
            cache_put("relevance", result, *cache_key)
            return result

    result = _token_overlap_score(question, answer)
    cache_put("relevance", result, *cache_key)
    return result
