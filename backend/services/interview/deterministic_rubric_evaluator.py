"""Deterministic rubric evaluator for interview turns."""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Tuple


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

_GENERIC_PHRASES = {
    "worked on a lot of things",
    "handled many tasks",
    "did a lot of work",
    "helped the team",
    "i am a team player",
    "good communication",
    "hard worker",
    "various projects",
    "different projects",
    "different kinds of tasks",
    "learned a lot",
    "i usually do my best",
    "i am passionate",
    "i am quick learner",
    "i'm a quick learner",
    "i can adapt easily",
    "it was challenging but i managed",
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


def _low_substance_ratio(answer_text: str) -> float:
    tokens = _tokens(answer_text)
    if not tokens:
        return 1.0
    content_count = len(_content_tokens(answer_text))
    return 1.0 - (content_count / max(len(tokens), 1))


def _answer_evidence_quality(
    answer_text: str,
    interview_type: str,
    star: Optional[Dict[str, bool]] = None,
    depth_signals: Optional[Dict[str, Any]] = None,
) -> tuple[int, str, List[str]]:
    lowered = (answer_text or "").lower()
    tokens = _tokens(lowered)
    word_count = len(tokens)
    if word_count == 0:
        return 1, "no_candidate_text", ["no_candidate_text"]

    star = star or _star_completeness(answer_text)
    depth_signals = depth_signals or extract_depth_signals(answer_text, interview_type)
    metrics = depth_signals.get("metrics_mentioned", []) or []
    ownership = int(depth_signals.get("ownership_signals", 0) or 0)
    impact = int(depth_signals.get("impact_signals", 0) or 0)
    tech_named = depth_signals.get("tech_named", []) or []
    generic_hits = _count_phrase_hits(lowered, _GENERIC_PHRASES)
    low_substance_ratio = _low_substance_ratio(answer_text)
    star_count = sum(1 for present in star.values() if present)
    result_present = bool(star.get("result"))
    action_present = bool(star.get("action"))

    weak_flags: List[str] = []
    score = 1.5

    if word_count >= 20:
        score += 0.5
    if ownership >= 1:
        score += 0.75
    if impact >= 1:
        score += 0.75
    if metrics:
        score += 0.75
    if interview_type in {"technical", "mixed"} and tech_named:
        score += 0.5
    if star_count >= 3:
        score += 0.75
    if result_present:
        score += 0.5

    if word_count >= 35 and ownership == 0 and impact == 0 and not metrics:
        score -= 0.75
        weak_flags.append("long_but_unspecific")
    if generic_hits > 0:
        score -= min(1.0, generic_hits * 0.4)
        weak_flags.append("generic_language")
    if low_substance_ratio > 0.62:
        score -= 0.75
        weak_flags.append("low_substance_density")
    if word_count >= 18 and not action_present:
        score -= 0.5
        weak_flags.append("missing_clear_action")
    if word_count >= 24 and not result_present:
        score -= 0.5
        weak_flags.append("missing_clear_result")
    if word_count >= 30 and ownership == 0:
        score -= 0.5
        weak_flags.append("weak_ownership")
    if interview_type == "technical" and word_count >= 28 and not tech_named and not metrics:
        score -= 0.5
        weak_flags.append("missing_technical_specifics")

    if score <= 2.5 and "generic_language" in weak_flags and "long_but_unspecific" in weak_flags:
        weak_flags.append("generic_low_evidence")

    reason = (
        f"word_count={word_count}, ownership={ownership}, impact={impact}, "
        f"metrics={len(metrics)}, star_count={star_count}, generic_hits={generic_hits}, "
        f"low_substance_ratio={round(low_substance_ratio, 3)}"
    )
    deduped_flags = list(dict.fromkeys(weak_flags))
    return _clip_score(score), reason, deduped_flags


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
    elif word_count <= 90:
        score += 0.5
    elif word_count > 140:
        score -= 0.25

    if sentence_count >= 2:
        score += 0.5
    if sentence_count >= 5 and word_count >= 90:
        score -= 0.25

    if filler_density > 0.08:
        score -= 1.0
    elif filler_density > 0.04:
        score -= 0.5

    if _low_substance_ratio(answer_text) > 0.62:
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

    score = 1.25
    if word_count >= 20:
        score += 0.5
    if word_count >= 45:
        score += 0.25
    if specifics >= 3:
        score += 1.0
    if specifics >= 6:
        score += 1.0

    if re.search(r"\b(tradeoff|constraint|risk|rollback|outcome|impact)\b", lowered):
        score += 0.5

    evidence_quality, evidence_reason, weak_flags = _answer_evidence_quality(answer_text, interview_type)
    if evidence_quality >= 4:
        score += 0.75
    elif evidence_quality <= 2:
        score -= 0.75
    if "generic_low_evidence" in weak_flags:
        score -= 0.5

    reason = (
        f"word_count={word_count}, specifics={specifics}, "
        f"number_hits={number_hits}, domain_hits={domain_hits}, "
        f"evidence_quality={evidence_quality} ({evidence_reason})"
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

    evidence_quality, evidence_reason, weak_flags = _answer_evidence_quality(answer_text, "mixed")

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

    if evidence_quality <= 2 and score > 3:
        score = 3
    if "generic_low_evidence" in weak_flags and score > 2:
        score -= 1
    if overlap_ratio < 0.15 and evidence_quality >= 4 and len(answer_tokens) >= 10:
        score = max(score, 3)

    reason = (
        f"question_anchors={len(question_tokens)}, overlap={len(overlap)}, "
        f"overlap_ratio={round(overlap_ratio, 3)}, "
        f"evidence_quality={evidence_quality} ({evidence_reason})"
    )
    return max(1, min(5, score)), reason


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

    score = 3.5

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

    if _count_phrase_hits(answer_text, _GENERIC_PHRASES) > 0:
        score -= 0.5

    reason = (
        f"filler_density={round(filler_density, 3)}, "
        f"hedge_density={round(hedge_density, 3)}, "
        f"filler_hits={filler_hits}, hedge_hits={hedge_hits}"
    )
    return _clip_score(score), reason


def extract_depth_signals(answer_text: str, interview_type: str = "mixed") -> Dict[str, Any]:
    """Extract structured depth signals from a candidate answer.

    Returns a dict with:
      - word_count: int
      - metrics_mentioned: list of metric strings found (numbers, %, etc.)
      - tech_named: list of technology/domain terms found
      - ownership_signals: count of I-led/I-built/I-designed type phrases
      - impact_signals: count of reduced/improved/delivered+metric phrases
      - hedge_hits: count of hedging phrases
    """
    text = (answer_text or "").strip()
    lowered = text.lower()
    tokens = re.findall(r"[a-z0-9][a-z0-9\-\+#\.]*", lowered)
    word_count = len(tokens)

    # Metrics: numbers with optional % or x (multipliers), time units, money
    metrics_mentioned = re.findall(
        r"\b\d+(?:\.\d+)?(?:\s*(?:%|x|×|times|ms|sec|seconds?|minutes?|hours?|days?|weeks?|months?|years?|k|m|b|gb|tb|\$|usd))?\b",
        lowered,
    )
    # Deduplicate while preserving order
    seen: set = set()
    metrics_dedup = []
    for m in metrics_mentioned:
        if m not in seen:
            seen.add(m)
            metrics_dedup.append(m)

    # Technology terms (a broad but practical list)
    _TECH_TERMS = {
        "python", "java", "javascript", "typescript", "golang", "rust", "c++",
        "react", "angular", "vue", "nodejs", "django", "fastapi", "flask", "spring",
        "kubernetes", "docker", "aws", "azure", "gcp", "terraform", "ansible",
        "postgres", "mysql", "mongodb", "redis", "kafka", "rabbitmq", "elasticsearch",
        "api", "rest", "graphql", "grpc", "microservices", "monolith", "lambda",
        "ci/cd", "github", "jenkins", "github actions", "ml", "llm", "pytorch",
        "tensorflow", "sklearn", "sql", "nosql", "spark", "airflow", "dbt",
        "cdn", "load balancer", "cache", "sharding", "replication", "index",
    }
    tech_named = [t for t in _TECH_TERMS if t in lowered]

    # Ownership phrases: first-person initiative
    _OWNERSHIP_PHRASES = [
        "i led", "i built", "i designed", "i developed", "i implemented",
        "i created", "i architected", "i owned", "i drove", "i introduced",
        "i proposed", "i initiated", "i launched", "i spearheaded",
    ]
    ownership_signals = sum(1 for p in _OWNERSHIP_PHRASES if p in lowered)

    # Impact phrases: outcome language with or without metrics
    _IMPACT_PHRASES = [
        "reduced", "improved", "increased", "decreased", "saved", "delivered",
        "shipped", "achieved", "optimized", "accelerated", "enabled",
        "as a result", "this resulted in", "led to", "outcome was",
    ]
    impact_signals = sum(1 for p in _IMPACT_PHRASES if p in lowered)

    # Hedge count (reuse from _HEDGE_PHRASES)
    hedge_hits = _count_phrase_hits(text, _HEDGE_PHRASES)

    return {
        "word_count": word_count,
        "metrics_mentioned": metrics_dedup[:10],
        "tech_named": tech_named[:10],
        "ownership_signals": ownership_signals,
        "impact_signals": impact_signals,
        "hedge_hits": hedge_hits,
    }


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
    star = _star_completeness(answer)
    depth_signals = extract_depth_signals(answer, interview_type)
    evidence_quality, evidence_reason, weak_signal_flags = _answer_evidence_quality(
        answer,
        interview_type,
        star=star,
        depth_signals=depth_signals,
    )
    depth, depth_reason = _depth_score(answer, interview_type)
    relevance, relevance_reason = _relevance_score(question, answer)
    answer_completeness = _clip_score(1 + (sum(1 for present in star.values() if present) * 0.9))

    if evidence_quality <= 2:
        depth = min(depth, 3)
        relevance = min(relevance, 3)
    if "generic_low_evidence" in weak_signal_flags:
        clarity = min(clarity, 3)
        communication = min(communication, 3)

    context_hint = []
    if role_context:
        context_hint.append(f"role={role_context}")
    if company_context:
        context_hint.append(f"company={company_context}")
    context_note = f" ({', '.join(context_hint)})" if context_hint else ""

    rationale = (
        f"deterministic_rubric: clarity[{clarity_reason}], "
        f"communication[{comm_reason}], "
        f"depth[{depth_reason}], relevance[{relevance_reason}], "
        f"evidence[{evidence_reason}]{context_note}"
    )

    return {
        "clarity": clarity,
        "communication": communication,
        "depth": depth,
        "relevance": relevance,
        "evidence_quality": evidence_quality,
        "answer_completeness": answer_completeness,
        "star_completeness": star,
        "depth_signals": depth_signals,
        "weak_signal_flags": weak_signal_flags,
        "reason_code": "deterministic_rubric_v3",
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
