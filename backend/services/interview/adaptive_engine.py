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

try:
    from services.interview.policy_guard import detect_interviewer_control_attempt
except Exception:  # pragma: no cover
    from backend.services.interview.policy_guard import detect_interviewer_control_attempt

try:
    from services.interview.skill_tracks import (
        filter_questions_for_track_ids,
        is_behavioral_track,
        is_technical_track,
        normalize_track_ids,
        question_matches_track,
        track_opening_question,
    )
except Exception:  # pragma: no cover
    from backend.services.interview.skill_tracks import (
        filter_questions_for_track_ids,
        is_behavioral_track,
        is_technical_track,
        normalize_track_ids,
        question_matches_track,
        track_opening_question,
    )

def _load_admin_question_bank_helpers():
    try:
        from services.interview.admin_question_bank import (  # type: ignore
            get_effective_questions_by_type_and_difficulty as _get_effective_questions,
            track_opening_question_effective as _track_opening_effective,
        )
        return _get_effective_questions, _track_opening_effective
    except Exception:
        try:
            from backend.services.interview.admin_question_bank import (  # type: ignore
                get_effective_questions_by_type_and_difficulty as _get_effective_questions,
                track_opening_question_effective as _track_opening_effective,
            )
            return _get_effective_questions, _track_opening_effective
        except Exception:
            return None, None


DIFFICULTY_LEVELS = ["junior", "mid", "senior"]
REFUSAL_MESSAGE = (
    "This is a formal interview. I will ask the questions based on the selected topics. Let's continue."
)


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


def _resolve_question_type(
    interview_type: str,
    question_mix: str,
    asked_count: int,
    selected_skills: Optional[List[str]] = None,
) -> str:
    interview = (interview_type or "mixed").strip().lower()
    mix = (question_mix or "balanced").strip().lower()
    selected = normalize_track_ids(selected_skills)
    selected_has_technical = any(is_technical_track(track_id) for track_id in selected)

    if interview in {"technical", "behavioral"}:
        return interview

    if mix == "technical":
        return "technical"
    if mix == "behavioral":
        return "behavioral"

    # Mixed + selected technical skill(s): force behavioral -> technical alternation.
    if interview == "mixed" and selected_has_technical:
        return "behavioral" if asked_count % 2 == 0 else "technical"

    # Mixed + balanced fallback.
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


def _family_fallback_questions(questions: List[Dict[str, Any]], interview_type: str) -> List[Dict[str, Any]]:
    qtype = (interview_type or "").strip().lower()
    if qtype == "behavioral":
        out = [q for q in questions if str(q.get("domain", "")).lower() == "behavioral"]
        return out or questions
    if qtype == "technical":
        out = [q for q in questions if str(q.get("domain", "")).lower() != "behavioral"]
        return out or questions
    return questions


def _track_hint_for_turn(
    *,
    selected_skills: List[str],
    question_type: str,
    asked_count: int,
) -> Optional[str]:
    if question_type == "technical":
        technical = [skill for skill in selected_skills if is_technical_track(skill)]
        if not technical:
            return None
        return technical[asked_count % len(technical)]

    if question_type == "behavioral":
        behavioral = [skill for skill in selected_skills if is_behavioral_track(skill)]
        if not behavioral:
            return None
        return behavioral[asked_count % len(behavioral)]

    return None


def _select_next_bank_question(
    interview_type: str,
    difficulty: str,
    asked_question_ids: List[str],
    role: Optional[str],
    selected_skills: Optional[List[str]] = None,
    db: Any = None,
) -> Tuple[Optional[str], Optional[str], str]:
    if db is not None:
        get_effective_questions, _ = _load_admin_question_bank_helpers()
        questions = (
            get_effective_questions(db, interview_type, difficulty)
            if get_effective_questions is not None
            else get_questions_by_type_and_difficulty(interview_type, difficulty)
        )
    else:
        questions = get_questions_by_type_and_difficulty(interview_type, difficulty)
    questions = _filter_questions_for_role(questions, role)
    selected = normalize_track_ids(selected_skills)

    if selected:
        track_hint = _track_hint_for_turn(
            selected_skills=selected,
            question_type=interview_type,
            asked_count=len(asked_question_ids),
        )
        if track_hint:
            per_track = [q for q in questions if question_matches_track(q, track_hint)]
            if per_track:
                questions = per_track
            else:
                constrained = filter_questions_for_track_ids(questions, selected)
                questions = constrained or _family_fallback_questions(questions, interview_type)
        else:
            constrained = filter_questions_for_track_ids(questions, selected)
            questions = constrained or _family_fallback_questions(questions, interview_type)

    unseen = [q for q in questions if q.get("id") not in asked_question_ids]
    pool = unseen if unseen else questions
    if not pool:
        return None, None, "No available questions in bank"

    # Deterministic pick by current turn index.
    index = len(asked_question_ids) % len(pool)
    selected = sorted(pool, key=lambda item: str(item.get("id", "")))[index]
    return selected.get("text"), selected.get("id"), "question_bank"


_CLARIFY_PROBES = [
    "Walk me through that from start to finish — what was the situation and what did you personally do?",
    "Let me zoom in on your specific role. What actions did you take, and what was the outcome?",
    "Can you ground that in a concrete example — what were you dealing with, what did you do, and what happened as a result?",
    "Help me understand your contribution. What problem were you solving and how exactly did you approach it?",
    "I'd like to understand the scope of your involvement. Could you give me a specific example of what you did?",
    "Tell me about a specific time that happened. What was the context, what was your action, and what changed because of it?",
]

_PROBE_PROBES = [
    "What was the actual outcome — any numbers, timelines, or measurable impact you can point to?",
    "Give me a concrete trade-off you had to make in that situation and why you chose the way you did.",
    "What was the hardest decision you had to make during that, and what was the consequence?",
    "How did you know it was successful? What did you use to measure that?",
    "What would have played out differently if you had taken a different approach?",
    "Tell me about a specific moment where something didn't go as planned — what did you do?",
]


def _followup_for_low_signal(last_user_turn: str, followup_type: str, turn_index: int = 0) -> str:
    if followup_type == "clarify":
        return _CLARIFY_PROBES[turn_index % len(_CLARIFY_PROBES)]
    return _PROBE_PROBES[turn_index % len(_PROBE_PROBES)]


def _is_echo_of_interviewer(user_turn: str, recent_transcript: List[Dict[str, Any]]) -> bool:
    """Return True if the user turn looks like an echo of the AI's own speech (mic loopback)."""
    if not user_turn:
        return False
    user_words = set(
        w for w in user_turn.lower().replace(",", " ").split() if len(w) > 2
    )
    if len(user_words) < 4:
        return False
    for msg in reversed(recent_transcript[-4:]):
        speaker = str(msg.get("speaker", "")).lower()
        if speaker not in {"ai", "interviewer", "sonia"}:
            continue
        ai_text = str(msg.get("text", ""))
        ai_words = set(w for w in ai_text.lower().replace(",", " ").split() if len(w) > 2)
        if not ai_words:
            continue
        overlap = len(user_words & ai_words) / len(user_words)
        if overlap >= 0.60:
            return True
    return False


def _intro_skill_probe_question(last_user_turn: str) -> Optional[Tuple[str, str]]:
    text = str(last_user_turn or "").strip().lower()
    if not text:
        return None

    probes = [
        ("python", "You mentioned Python. Can you explain one Python project where you handled errors and edge cases?"),
        ("sql", "You mentioned SQL. Can you walk me through how you optimized a slow query or improved a database design?"),
        ("github", "You mentioned GitHub. How do you structure branches and pull requests in a team workflow?"),
        ("cloud", "You mentioned cloud. How would you deploy a beginner web service with logging and basic monitoring?"),
        ("java", "You mentioned Java. Can you explain how you would structure a simple layered backend service in Java?"),
        ("spring", "You mentioned Spring. How would you build and expose a basic REST endpoint and validate input?"),
        ("react", "You mentioned React. How do you manage component state and avoid unnecessary re-renders?"),
        ("node", "You mentioned Node.js. How would you structure an API route and handle errors consistently?"),
        ("machine learning", "You mentioned machine learning. Can you describe your model evaluation process and metric selection?"),
        ("ml", "You mentioned ML. Can you describe your model evaluation process and metric selection?"),
        ("gen ai", "You mentioned GenAI. How would you design guardrails and prompt/version tracking in a production flow?"),
        ("genai", "You mentioned GenAI. How would you design guardrails and prompt/version tracking in a production flow?"),
        ("azure", "You mentioned Azure. Which Azure services would you choose first for a beginner GenAI application and why?"),
        ("aws", "You mentioned AWS. Which AWS services would you choose first for a beginner GenAI application and why?"),
    ]
    for needle, question in probes:
        if needle in text:
            slug = (
                needle.replace(" ", "_")
                .replace(".", "_")
                .replace("/", "_")
            )
            return question, slug
    return None


def choose_opening_question(
    *,
    interview_type: str,
    difficulty: str,
    role: Optional[str],
    question_mix: str,
    selected_skills: Optional[List[str]] = None,
    db: Any = None,
) -> Dict[str, Any]:
    selected = normalize_track_ids(selected_skills)
    technical_selected = [skill_id for skill_id in selected if is_technical_track(skill_id)]

    # Stream-first behavior for technical/mixed interviews.
    if interview_type in {"technical", "mixed"} and technical_selected:
        if db is not None:
            _, track_opening_effective = _load_admin_question_bank_helpers()
            opening = (
                track_opening_effective(db, technical_selected[0])
                if track_opening_effective is not None
                else track_opening_question(technical_selected[0])
            )
        else:
            opening = track_opening_question(technical_selected[0])
        if opening:
            return {
                "next_question": opening,
                "question_id": f"stream_opening_{technical_selected[0]}",
                "source": "stream_opening",
                "selected_skills_applied": selected,
            }

    bank_type = _resolve_question_type(
        interview_type=interview_type,
        question_mix=question_mix,
        asked_count=0,
        selected_skills=selected,
    )
    question, question_id, source = _select_next_bank_question(
        interview_type=bank_type,
        difficulty=normalize_difficulty(difficulty),
        asked_question_ids=[],
        role=role,
        selected_skills=selected,
        db=db,
    )

    if not question:
        if bank_type == "behavioral":
            question = "Tell me about a recent challenge at work and how you handled it."
        else:
            question = "Describe a recent technical problem you solved, including your approach and tradeoffs."
        question_id = "fallback_opening"
        source = "fallback_opening"

    return {
        "next_question": question,
        "question_id": question_id,
        "source": source,
        "selected_skills_applied": selected,
    }


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
    selected_skills: Optional[List[str]] = None,
    db: Any = None,
) -> Dict[str, Any]:
    """Return next question and turn evaluation for adaptive interview control."""

    normalized_difficulty = normalize_difficulty(difficulty)
    normalized_selected_skills = normalize_track_ids(selected_skills)

    if detect_interviewer_control_attempt(last_user_turn):
        bank_type = _resolve_question_type(
            interview_type=interview_type,
            question_mix=question_mix,
            asked_count=len(asked_question_ids),
            selected_skills=normalized_selected_skills,
        )
        next_question, question_id, source = _select_next_bank_question(
            interview_type=bank_type,
            difficulty=normalized_difficulty,
            asked_question_ids=asked_question_ids,
            role=role,
            selected_skills=normalized_selected_skills,
            db=db,
        )
        if not next_question:
            next_question = "Can you walk me through a recent project and your specific contribution?"
            question_id = "fallback_generic"
            source = "fallback"

        return {
            "next_question": next_question,
            "question_id": question_id,
            "reason": "policy_meta_control_attempt",
            "followup_type": "policy_refusal",
            "difficulty_next": normalized_difficulty,
            "turn_scores": {
                "clarity": 0,
                "depth": 0,
                "relevance": 0,
                "confidence": "low",
                "rationale": "candidate attempted to control interviewer flow; request refused",
            },
            "policy_action": "REFUSED_META_CONTROL",
            "refusal_message": REFUSAL_MESSAGE,
            "selected_skills_applied": normalized_selected_skills,
            "adaptive_path": {
                "interview_style": interview_style,
                "question_mix": question_mix,
                "duration_minutes": duration_minutes,
                "source": source,
            },
        }

    context_lines = []
    for msg in recent_transcript[-8:]:
        speaker = str(msg.get("speaker", "")).lower()
        text = str(msg.get("text", "")).strip()
        if not text:
            continue
        label = "INTERVIEWER" if speaker in {"ai", "interviewer", "sonia"} else "CANDIDATE"
        context_lines.append(f"{label}: {text}")

    # Echo detection: if candidate "answer" looks like the AI's own speech being looped back
    # through the mic, skip evaluation and move on to the next question silently.
    if _is_echo_of_interviewer(last_user_turn, recent_transcript):
        bank_type = _resolve_question_type(
            interview_type=interview_type,
            question_mix=question_mix,
            asked_count=len(asked_question_ids),
            selected_skills=normalized_selected_skills,
        )
        next_question, question_id, source = _select_next_bank_question(
            interview_type=bank_type,
            difficulty=normalized_difficulty,
            asked_question_ids=asked_question_ids,
            role=role,
            selected_skills=normalized_selected_skills,
            db=db,
        )
        if not next_question:
            next_question = "Can you tell me about a project you're particularly proud of and your specific contribution?"
            question_id = "fallback_echo_skip"
            source = "fallback"
        return {
            "next_question": next_question,
            "question_id": question_id,
            "reason": "echo_detected_skip",
            "followup_type": "move_on",
            "difficulty_next": normalized_difficulty,
            "turn_scores": {},
            "selected_skills_applied": normalized_selected_skills,
            "adaptive_path": {
                "interview_style": interview_style,
                "question_mix": question_mix,
                "duration_minutes": duration_minutes,
                "source": source,
            },
        }

    # Minimum evidence gate: answers < 12 words are too short to evaluate meaningfully.
    # Skip scoring and move on — don't trigger follow-up probes on noise/echo fragments.
    meaningful_words = [w for w in last_user_turn.split() if len(w) > 1]
    if len(meaningful_words) < 12:
        bank_type = _resolve_question_type(
            interview_type=interview_type,
            question_mix=question_mix,
            asked_count=len(asked_question_ids),
            selected_skills=normalized_selected_skills,
        )
        next_question, question_id, source = _select_next_bank_question(
            interview_type=bank_type,
            difficulty=normalized_difficulty,
            asked_question_ids=asked_question_ids,
            role=role,
            selected_skills=normalized_selected_skills,
            db=db,
        )
        if not next_question:
            next_question = "Take your time — tell me about a project or situation you're proud of."
            question_id = "fallback_short_answer"
            source = "fallback"
        return {
            "next_question": next_question,
            "question_id": question_id,
            "reason": "short_answer_skip",
            "followup_type": "move_on",
            "difficulty_next": normalized_difficulty,
            "turn_scores": {},
            "selected_skills_applied": normalized_selected_skills,
            "adaptive_path": {
                "interview_style": interview_style,
                "question_mix": question_mix,
                "duration_minutes": duration_minutes,
                "source": source,
            },
        }

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
        next_question = _followup_for_low_signal(last_user_turn, followup_type, turn_index=len(asked_question_ids))
        question_id = f"followup_{followup_type}"
        source = "adaptive_followup"
    else:
        intro_probe = None
        if (interview_type or "").strip().lower() in {"technical", "mixed"} and len(asked_question_ids) <= 2:
            intro_probe = _intro_skill_probe_question(last_user_turn)
        if intro_probe:
            probe_question, probe_slug = intro_probe
            next_question = probe_question
            question_id = f"intro_skill_{probe_slug}"
            source = "intro_skill_probe"
            reason = "intro_skill_probe"
        else:
            bank_type = _resolve_question_type(
                interview_type,
                question_mix,
                len(asked_question_ids),
                normalized_selected_skills,
            )
            next_question, question_id, source = _select_next_bank_question(
                interview_type=bank_type,
                difficulty=difficulty_next,
                asked_question_ids=asked_question_ids,
                role=role,
                selected_skills=normalized_selected_skills,
                db=db,
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
        "policy_action": "NONE",
        "refusal_message": None,
        "selected_skills_applied": normalized_selected_skills,
        "adaptive_path": {
            "interview_style": interview_style,
            "question_mix": question_mix,
            "duration_minutes": duration_minutes,
            "source": source,
        },
    }
