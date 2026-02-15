"""Adaptive question selection engine.

Hybrid approach:
- deterministic policy routing
- question bank selection by interview type + difficulty + mix + role hints
- LangChain turn evaluator with safe fallback
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

try:
    from data.interview_questions import get_questions_by_type_and_difficulty
except Exception:  # pragma: no cover
    from backend.data.interview_questions import get_questions_by_type_and_difficulty

try:
    from services.llm.chains.turn_evaluator import evaluate_turn
except Exception:  # pragma: no cover
    from backend.services.llm.chains.turn_evaluator import evaluate_turn


DIFFICULTY_LEVELS = ["junior", "mid", "senior"]


def normalize_difficulty(value: Optional[str]) -> str:
    raw = (value or "mid").strip().lower()
    mapping = {
        "easy": "junior",
        "junior": "junior",
        "beginner": "junior",
        "medium": "mid",
        "mid": "mid",
        "intermediate": "mid",
        "hard": "senior",
        "senior": "senior",
        "advanced": "senior",
    }
    return mapping.get(raw, "mid")


def _difficulty_delta(current: str, delta: int) -> str:
    try:
        idx = DIFFICULTY_LEVELS.index(current)
    except ValueError:
        idx = 1
    idx = max(0, min(len(DIFFICULTY_LEVELS) - 1, idx + delta))
    return DIFFICULTY_LEVELS[idx]


def _resolve_question_type(interview_type: str, question_mix: str, asked_count: int) -> str:
    interview = (interview_type or "mixed").strip().lower()
    mix = (question_mix or "balanced").strip().lower()

    if mix == "technical":
        return "technical"
    if mix == "behavioral":
        return "behavioral"

    if interview in {"technical", "behavioral"}:
        return interview

    # Mixed + balanced: alternate to keep interview realistic.
    return "technical" if asked_count % 2 else "behavioral"


def _role_domains(role: Optional[str]) -> List[str]:
    role_value = (role or "").lower()
    mapping = {
        "backend": ["backend", "system_design", "api", "database", "distributed"],
        "frontend": ["frontend", "ui", "react", "web", "javascript"],
        "data": ["data", "sql", "ml", "analytics"],
        "devops": ["devops", "sre", "cloud", "reliability", "ops"],
        "product": ["product", "stakeholder", "metrics"],
    }
    out: List[str] = []
    for needle, domains in mapping.items():
        if needle in role_value:
            out.extend(domains)
    return out


def _filter_questions_for_role(questions: List[Dict[str, Any]], role: Optional[str]) -> List[Dict[str, Any]]:
    domains = _role_domains(role)
    if not domains:
        return questions

    filtered: List[Dict[str, Any]] = []
    for q in questions:
        domain = str(q.get("domain", "")).lower()
        tags = [str(t).lower() for t in (q.get("topic_tags") or [])]
        if any(d in domain for d in domains) or any(any(d in tag for d in domains) for tag in tags):
            filtered.append(q)

    return filtered or questions


def _select_next_bank_question(
    interview_type: str,
    difficulty: str,
    asked_question_ids: List[str],
    role: Optional[str],
) -> Tuple[Optional[str], Optional[str], str]:
    questions = get_questions_by_type_and_difficulty(interview_type, difficulty)
    questions = _filter_questions_for_role(questions, role)

    unseen = [q for q in questions if q.get("id") not in asked_question_ids]
    pool = unseen if unseen else questions
    if not pool:
        return None, None, "No available questions in bank"

    # Deterministic pick by current turn index.
    index = len(asked_question_ids) % len(pool)
    selected = sorted(pool, key=lambda item: str(item.get("id", "")))[index]
    return selected.get("text"), selected.get("id"), "question_bank"


def _followup_for_low_signal(last_user_turn: str, followup_type: str) -> str:
    if followup_type == "clarify":
        return (
            "Please clarify your previous answer in a clearer structure. "
            "Start with context, then your action, and then the outcome."
        )

    return (
        "Can you go deeper with one concrete example, including your exact decisions, "
        "trade-offs, and measurable outcome?"
    )


def decide_next_turn(
    *,
    last_user_turn: str,
    recent_transcript: List[Dict[str, Any]],
    interview_type: str,
    difficulty: str,
    role: Optional[str],
    company: Optional[str],
    question_mix: str,
    interview_style: str,
    duration_minutes: Optional[int],
    asked_question_ids: List[str],
) -> Dict[str, Any]:
    """Return next question and turn evaluation for adaptive interview control."""

    normalized_difficulty = normalize_difficulty(difficulty)
    context_lines = []
    for msg in recent_transcript[-8:]:
        speaker = str(msg.get("speaker", "")).lower()
        text = str(msg.get("text", "")).strip()
        if not text:
            continue
        label = "INTERVIEWER" if speaker in {"ai", "interviewer", "sonia"} else "CANDIDATE"
        context_lines.append(f"{label}: {text}")

    turn_scores = evaluate_turn(
        user_turn=last_user_turn,
        interview_type=interview_type,
        difficulty=normalized_difficulty,
        role=role,
        company=company,
        recent_context="\n".join(context_lines),
    )

    clarity = int(turn_scores.get("clarity", 3))
    depth = int(turn_scores.get("depth", 3))
    relevance = int(turn_scores.get("relevance", 3))
    avg = (clarity + depth + relevance) / 3.0

    followup_type = "move_on"
    reason = "balanced_progression"
    difficulty_next = normalized_difficulty

    if relevance <= 2:
        followup_type = "clarify"
        reason = "low_relevance"
    elif depth <= 2:
        followup_type = "probe"
        reason = "low_depth"
    else:
        if avg >= 4.2:
            difficulty_next = _difficulty_delta(normalized_difficulty, 1)
            reason = "raise_bar"
        elif avg <= 2.2:
            difficulty_next = _difficulty_delta(normalized_difficulty, -1)
            reason = "reduce_bar"

    if followup_type in {"clarify", "probe"}:
        next_question = _followup_for_low_signal(last_user_turn, followup_type)
        question_id = f"followup_{followup_type}"
        source = "adaptive_followup"
    else:
        bank_type = _resolve_question_type(interview_type, question_mix, len(asked_question_ids))
        next_question, question_id, source = _select_next_bank_question(
            interview_type=bank_type,
            difficulty=difficulty_next,
            asked_question_ids=asked_question_ids,
            role=role,
        )

    if not next_question:
        next_question = "Can you walk me through a recent project and your specific contribution?"
        question_id = "fallback_generic"
        source = "fallback"

    return {
        "next_question": next_question,
        "question_id": question_id,
        "reason": reason,
        "followup_type": followup_type,
        "difficulty_next": difficulty_next,
        "turn_scores": turn_scores,
        "adaptive_path": {
            "interview_style": interview_style,
            "question_mix": question_mix,
            "duration_minutes": duration_minutes,
            "source": source,
        },
    }
