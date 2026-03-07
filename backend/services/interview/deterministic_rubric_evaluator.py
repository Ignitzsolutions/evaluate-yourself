"""Deterministic rubric evaluator for interview turns."""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional


_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "we",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "you",
    "your",
}

_FILLER_WORDS = {
    "um",
    "uh",
    "er",
    "ah",
    "like",
    "basically",
    "actually",
    "literally",
    "you know",
    "kind of",
    "sort of",
}

_GENERAL_SPECIFICS = {
    "because",
    "therefore",
    "result",
    "impact",
    "tradeoff",
    "constraint",
    "decision",
    "designed",
    "implemented",
    "optimized",
    "measured",
    "reduced",
    "increased",
    "improved",
    "deadline",
    "incident",
    "postmortem",
    "metric",
    "latency",
    "throughput",
    "availability",
    "scale",
}

_TECHNICAL_SPECIFICS = {
    "api",
    "cache",
    "database",
    "queue",
    "kafka",
    "redis",
    "sql",
    "nosql",
    "index",
    "shard",
    "load",
    "balancer",
    "service",
    "microservice",
    "pipeline",
    "ci",
    "cd",
    "testing",
    "rollback",
    "monitoring",
    "slo",
    "sla",
}

_BEHAVIORAL_SPECIFICS = {
    "team",
    "stakeholder",
    "customer",
    "conflict",
    "leadership",
    "collaboration",
    "ownership",
    "mentor",
    "feedback",
    "priority",
}

# Hedging / weak communication phrases
_HEDGE_PHRASES = {
    "i think",
    "i guess",
    "maybe",
    "probably",
    "i'm not sure",
    "not really sure",
    "kind of",
    "sort of",
    "i don't know",
    "to be honest",
    "honestly",
}

# STAR component keyword sets
_STAR_SITUATION = {"situation", "context", "background", "project", "company", "role", "team", "working", "was working", "at the time"}
_STAR_TASK = {"task", "goal", "objective", "needed", "responsible", "assigned", "challenge", "problem", "issue"}
_STAR_ACTION = {"i did", "i took", "i built", "i led", "i implemented", "i designed", "i created", "i worked", "i wrote", "i fixed", "i decided", "i started", "i reached out", "i proposed", "i set up", "i developed", "i coordinated"}
_STAR_RESULT = {"result", "outcome", "impact", "improved", "reduced", "increased", "achieved", "delivered", "shipped", "saved", "success", "learned", "led to", "this resulted", "as a result", "ultimately"}


def _tokens(text: str) -> List[str]:
    return re.findall(r"[a-z0-9][a-z0-9\-\+#\.]*", (text or "").lower())


def _content_tokens(text: str) -> List[str]:
    return [tok for tok in _tokens(text) if tok not in _STOPWORDS and len(tok) > 2]


def _clip_score(value: float) -> int:
    return max(1, min(5, int(round(value))))


def _excerpt(text: str, limit: int = 180) -> str:
    compact = " ".join((text or "").split())
    if len(compact) <= limit:
        return compact
    return compact[: max(0, limit - 3)].rstrip() + "..."


def _count_phrase_hits(text: str, phrases: Iterable[str]) -> int:
    lowered = (text or "").lower()
    return sum(1 for phrase in phrases if phrase in lowered)


def _clarity_score(answer_text: str) -> tuple[int, str]:
    tokens = _tokens(answer_text)
    word_count = len(tokens)
    if word_count == 0:
        return 1, "no_candidate_text"

    sentence_chunks = [chunk for chunk in re.split(r"[.!?]+", answer_text) if chunk.strip()]
    sentence_count = len(sentence_chunks)
    filler_hits = _count_phrase_hits(answer_text, _FILLER_WORDS)
    filler_density = filler_hits / max(word_count, 1)

    score = 3.0
    if word_count < 12:
        score -= 2.0
    elif word_count < 25:
        score -= 1.0
    elif word_count >= 50:
        score += 1.0

    if sentence_count >= 2:
        score += 0.5
    if sentence_count >= 4 and word_count >= 60:
        score += 0.5

    if filler_density > 0.08:
        score -= 1.0
    elif filler_density > 0.04:
        score -= 0.5

    if answer_text and answer_text[-1] not in ".!?":
        score -= 0.25

    if re.search(r"\b(so yeah|that's it|not sure)\b", answer_text.lower()):
        score -= 0.5

    reason = (
        f"word_count={word_count}, sentence_count={sentence_count}, "
        f"filler_density={round(filler_density, 3)}"
    )
    return _clip_score(score), reason


def _depth_score(answer_text: str, interview_type: str) -> tuple[int, str]:
    tokens = _tokens(answer_text)
    word_count = len(tokens)
    if word_count == 0:
        return 1, "no_candidate_text"

    lowered = answer_text.lower()
    number_hits = len(re.findall(r"\b\d+(\.\d+)?%?\b", lowered))
    general_hits = _count_phrase_hits(lowered, _GENERAL_SPECIFICS)
    if interview_type == "technical":
        domain_hits = _count_phrase_hits(lowered, _TECHNICAL_SPECIFICS)
    elif interview_type == "behavioral":
        domain_hits = _count_phrase_hits(lowered, _BEHAVIORAL_SPECIFICS)
    else:
        domain_hits = _count_phrase_hits(lowered, _TECHNICAL_SPECIFICS | _BEHAVIORAL_SPECIFICS)

    specifics = number_hits + general_hits + domain_hits

    score = 1.5
    if word_count >= 25:
        score += 1.0
    if word_count >= 70:
        score += 0.5
    if specifics >= 3:
        score += 1.0
    if specifics >= 6:
        score += 1.0

    if re.search(r"\b(tradeoff|constraint|risk|rollback|outcome|impact)\b", lowered):
        score += 0.5

    reason = (
        f"word_count={word_count}, specifics={specifics}, "
        f"number_hits={number_hits}, domain_hits={domain_hits}"
    )
    return _clip_score(score), reason


def _relevance_score(question_text: str, answer_text: str) -> tuple[int, str]:
    answer_tokens = set(_content_tokens(answer_text))
    if not answer_tokens:
        return 1, "no_candidate_text"

    question_tokens = set(_content_tokens(question_text))
    if not question_tokens:
        # No question anchor available; use a conservative neutral default.
        if len(answer_tokens) < 8:
            return 2, "no_question_anchor_short_answer"
        return 3, "no_question_anchor"

    overlap = question_tokens.intersection(answer_tokens)
    overlap_ratio = len(overlap) / max(len(question_tokens), 1)

    if overlap_ratio >= 0.60:
        score = 5
    elif overlap_ratio >= 0.35:
        score = 4
    elif overlap_ratio >= 0.15:
        score = 3
    elif len(answer_tokens) < 8:
        score = 1
    else:
        score = 2

    reason = (
        f"question_anchors={len(question_tokens)}, overlap={len(overlap)}, "
        f"overlap_ratio={round(overlap_ratio, 3)}"
    )
    return score, reason


def _communication_score(answer_text: str) -> tuple[int, str]:
    """Score communication quality: filler density, hedging, and sentence delivery.

    Distinct from clarity (which scores word count and sentence length).
    This dimension measures HOW confidently and cleanly the candidate speaks.
    """
    tokens = _tokens(answer_text)
    word_count = len(tokens)
    if word_count == 0:
        return 1, "no_candidate_text"

    filler_hits = _count_phrase_hits(answer_text, _FILLER_WORDS)
    hedge_hits = _count_phrase_hits(answer_text, _HEDGE_PHRASES)
    filler_density = filler_hits / max(word_count, 1)
    hedge_density = hedge_hits / max(word_count, 1)

    score = 4.0  # Start at good baseline

    # Filler penalties
    if filler_density > 0.10:
        score -= 2.0
    elif filler_density > 0.06:
        score -= 1.0
    elif filler_density > 0.03:
        score -= 0.5

    # Hedging penalties
    if hedge_density > 0.05:
        score -= 1.0
    elif hedge_density > 0.02:
        score -= 0.5

    # Weak-ending penalty
    if re.search(r"\b(so yeah|that's it|not sure|i guess that's|does that make sense\?)\b", answer_text.lower()):
        score -= 0.5

    # Reward clear finish
    if answer_text.strip() and answer_text.strip()[-1] in ".!?":
        score += 0.25

    reason = (
        f"filler_density={round(filler_density, 3)}, "
        f"hedge_density={round(hedge_density, 3)}, "
        f"filler_hits={filler_hits}, hedge_hits={hedge_hits}"
    )
    return _clip_score(score), reason


def _star_completeness(answer_text: str) -> Dict[str, bool]:
    """Detect presence of Situation, Task, Action, Result in an answer."""
    lowered = (answer_text or "").lower()
    return {
        "situation": any(phrase in lowered for phrase in _STAR_SITUATION),
        "task": any(phrase in lowered for phrase in _STAR_TASK),
        "action": any(phrase in lowered for phrase in _STAR_ACTION),
        "result": any(phrase in lowered for phrase in _STAR_RESULT),
    }


def evaluate_turn(
    *,
    question_text: str,
    candidate_answer_text: str,
    interview_type: str = "mixed",
    role_context: Optional[str] = None,
    company_context: Optional[str] = None,
) -> Dict[str, Any]:
    """Evaluate one candidate turn with deterministic rubric rules."""
    answer = (candidate_answer_text or "").strip()
    question = (question_text or "").strip()

    clarity, clarity_reason = _clarity_score(answer)
    communication, comm_reason = _communication_score(answer)
    depth, depth_reason = _depth_score(answer, interview_type)
    relevance, relevance_reason = _relevance_score(question, answer)
    star = _star_completeness(answer)

    context_hint = []
    if role_context:
        context_hint.append(f"role={role_context}")
    if company_context:
        context_hint.append(f"company={company_context}")
    context_note = f" ({', '.join(context_hint)})" if context_hint else ""

    rationale = (
        f"deterministic_rubric: clarity[{clarity_reason}], "
        f"communication[{comm_reason}], "
        f"depth[{depth_reason}], relevance[{relevance_reason}]{context_note}"
    )

    return {
        "clarity": clarity,
        "communication": communication,
        "depth": depth,
        "relevance": relevance,
        "star_completeness": star,
        "reason_code": "deterministic_rubric_v1",
        "rationale": rationale,
        "evidence_excerpt": _excerpt(answer),
    }


def evaluate_turns(
    *,
    turns: List[Dict[str, Any]],
    interview_type: str = "mixed",
    role_context: Optional[str] = None,
    company_context: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Evaluate all candidate turns in deterministic mode."""
    results: List[Dict[str, Any]] = []
    for idx, turn in enumerate(turns):
        if not isinstance(turn, dict):
            continue
        answer = (turn.get("answer") or turn.get("candidate_answer_text") or "").strip()
        if not answer:
            continue
        question = (turn.get("question") or turn.get("interviewer_question_text") or "").strip()
        scored = evaluate_turn(
            question_text=question,
            candidate_answer_text=answer,
            interview_type=interview_type,
            role_context=role_context,
            company_context=company_context,
        )
        scored["turn_id"] = idx + 1
        results.append(scored)
    return results


def compute_confidence_tier(candidate_word_count: int, turns_evaluated: int) -> str:
    """Deterministic confidence tier based on capture evidence."""
    if candidate_word_count <= 0 or turns_evaluated <= 0:
        return "none"
    if candidate_word_count < 50 or turns_evaluated < 2:
        return "low"
    if candidate_word_count >= 250 and turns_evaluated >= 4:
        return "high"
    return "medium"

