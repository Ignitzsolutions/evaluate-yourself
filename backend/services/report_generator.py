"""Report generation service for interview sessions."""

from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid
import re
from models.interview import (
    InterviewReport, TranscriptMessage, ScoreBreakdown,
    TurnAnalysis, StarBreakdown, ImprovementItem, HiringRecommendation,
)


SCORE_WEIGHTS = {
    "clarity": 0.25,
    "communication": 0.20,
    "depth": 0.30,
    "relevance": 0.25,
}

_WEAK_SIGNAL_FLAGS = {
    "generic_low_evidence",
    "long_but_unspecific",
    "low_substance_density",
    "missing_clear_action",
    "missing_clear_result",
    "weak_ownership",
    "missing_technical_specifics",
}


def overall_score_formula_text() -> str:
    return (
        "overall = ((clarity × 0.25) + (communication × 0.20) + "
        "(depth × 0.30) + (relevance × 0.25)) × 20"
    )


def overall_score_weight_summary() -> Dict[str, float]:
    return dict(SCORE_WEIGHTS)


def _turn_answer_word_count(answer: str) -> int:
    return len([word for word in str(answer or "").split() if len(word) > 1])


def _looks_like_question_echo(question: str, answer: str) -> bool:
    question_words = {word.lower() for word in str(question or "").split() if len(word) > 2}
    answer_words = {word.lower() for word in str(answer or "").split() if len(word) > 2}
    if not question_words or not answer_words:
        return False
    return len(question_words & answer_words) / len(answer_words) >= 0.60


def build_score_ledger(
    transcript_history: List[Dict[str, Any]],
    evaluations: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Build an auditable turn-by-turn score ledger."""
    evals_by_turn: Dict[int, Dict[str, Any]] = {}
    for idx, item in enumerate(evaluations or []):
        if not isinstance(item, dict):
            continue
        try:
            turn_id = int(item.get("turn_id") or idx + 1)
        except Exception:
            turn_id = idx + 1
        evals_by_turn[turn_id] = item

    ledger: List[Dict[str, Any]] = []
    for idx, row in enumerate(transcript_history or []):
        if not isinstance(row, dict):
            continue
        question = str(row.get("question") or "").strip()
        answer = str(row.get("answer") or "").strip()
        timestamp = str(row.get("timestamp") or "").strip() or None
        if not answer:
            continue

        turn_id = idx + 1
        answer_word_count = _turn_answer_word_count(answer)
        eval_row = evals_by_turn.get(turn_id, {})
        dimension_scores = {
            key: (float(eval_row.get(key)) if isinstance(eval_row.get(key), (int, float)) else None)
            for key in SCORE_WEIGHTS
        }
        included_in_score = any(value is not None for value in dimension_scores.values())
        exclusion_reason = None
        if not included_in_score:
            if answer_word_count < 8:
                exclusion_reason = "answer_too_short"
            elif _looks_like_question_echo(question, answer):
                exclusion_reason = "answer_echoed_question"
            else:
                exclusion_reason = "not_evaluated"
        exclusion_detail = None
        if exclusion_reason == "answer_too_short":
            exclusion_detail = "Answer did not contain enough evidence-bearing detail for a reliable score."
        elif exclusion_reason == "answer_echoed_question":
            exclusion_detail = "Answer overlapped heavily with the interviewer question and was treated as non-evidence."
        elif exclusion_reason == "not_evaluated":
            exclusion_detail = "Turn was captured but did not receive a scoring pass in the final evaluation pipeline."

        weighted_points = 0.0
        if included_in_score:
            weighted_points = round(
                sum((dimension_scores[key] or 0.0) * weight for key, weight in SCORE_WEIGHTS.items()) * 20,
                1,
            )

        rationale_codes = []
        reason_code = str(eval_row.get("reason_code") or "").strip()
        if reason_code:
            rationale_codes.append(reason_code)
        confidence = str(eval_row.get("confidence") or "").strip()
        if confidence:
            rationale_codes.append(f"confidence:{confidence}")
        weak_signal_flags = [
            str(flag).strip()
            for flag in (eval_row.get("weak_signal_flags") or [])
            if str(flag).strip()
        ]
        rationale_codes.extend(f"weak:{flag}" for flag in weak_signal_flags)

        evidence_quote = (
            str(eval_row.get("evidence_excerpt") or "").strip()
            or answer[:220]
        )

        ledger.append(
            {
                "turn_id": turn_id,
                "transcript_ref": f"turn_{turn_id}",
                "transcript_timestamp": timestamp,
                "transcript_ref_label": (
                    f"Turn {turn_id} • {timestamp}" if timestamp else f"Turn {turn_id}"
                ),
                "question_text": question,
                "question_id": eval_row.get("question_id"),
                "included_in_score": included_in_score,
                "exclusion_reason": exclusion_reason,
                "exclusion_detail": exclusion_detail,
                "answer_word_count": answer_word_count,
                "answer_excerpt": answer[:220],
                "dimension_scores": dimension_scores,
                "evidence_quality": eval_row.get("evidence_quality"),
                "answer_completeness": eval_row.get("answer_completeness"),
                "weighted_points": weighted_points,
                "weight_contribution_pct": round(weighted_points, 1),
                "evidence_quote": evidence_quote,
                "rationale_codes": rationale_codes,
                "weak_signal_flags": weak_signal_flags,
            }
        )

    return ledger


def _score_quality_multiplier(evaluations: List[Dict[str, Any]]) -> float:
    if not evaluations:
        return 0.0

    weak_turns = 0
    strong_turns = 0
    for evaluation in evaluations:
        if not isinstance(evaluation, dict):
            continue
        flags = {
            str(flag).strip()
            for flag in (evaluation.get("weak_signal_flags") or [])
            if str(flag).strip()
        }
        evidence_quality = float(evaluation.get("evidence_quality") or 0)
        completeness = float(evaluation.get("answer_completeness") or 0)
        if flags & _WEAK_SIGNAL_FLAGS or evidence_quality <= 2:
            weak_turns += 1
        if evidence_quality >= 4 and completeness >= 4:
            strong_turns += 1

    total = max(len(evaluations), 1)
    weak_ratio = weak_turns / total
    strong_ratio = strong_turns / total

    multiplier = 1.0
    if weak_ratio >= 0.75:
        multiplier -= 0.30
    elif weak_ratio >= 0.50:
        multiplier -= 0.18
    elif weak_ratio >= 0.25:
        multiplier -= 0.08

    if strong_ratio >= 0.50:
        multiplier += 0.05

    return max(0.65, min(1.05, multiplier))


def _has_credible_scoring_signal(evaluations: List[Dict[str, Any]]) -> bool:
    for evaluation in evaluations or []:
        if not isinstance(evaluation, dict):
            continue
        evidence_quality = float(evaluation.get("evidence_quality") or 0)
        completeness = float(evaluation.get("answer_completeness") or 0)
        flags = {
            str(flag).strip()
            for flag in (evaluation.get("weak_signal_flags") or [])
            if str(flag).strip()
        }
        if evidence_quality >= 3 and completeness >= 3 and "generic_low_evidence" not in flags:
            return True
    return False


def generate_report(
    session_state: Any,  # InterviewState
    interview_type: str,
    duration_minutes: int,
    skip_v2: bool = False,
) -> InterviewReport:
    """
    Generate a comprehensive interview report from session state and evaluations.
    
    Args:
        session_state: InterviewState instance with all session data (can be None)
        interview_type: Type of interview (behavioral, technical, mixed)
        duration_minutes: Total interview duration in minutes
    
    Returns:
        InterviewReport model instance
    """
    # Handle missing session_state gracefully
    if not session_state:
        return _generate_minimal_report(interview_type, duration_minutes)
    
    evaluations = session_state.evaluation_results if hasattr(session_state, 'evaluation_results') else []
    transcript_history = session_state.transcript_history if hasattr(session_state, 'transcript_history') else []
    candidate_answers = [
        (item.get("answer") or "").strip()
        for item in transcript_history
        if isinstance(item, dict) and (item.get("answer") or "").strip()
    ]
    capture_incomplete = len(candidate_answers) == 0 and len(evaluations) == 0
    
    # Handle missing get_performance_summary method
    if hasattr(session_state, 'get_performance_summary'):
        performance_summary = session_state.get_performance_summary()
    else:
        performance_summary = {"avg_clarity": 0, "avg_depth": 0, "avg_relevance": 0}
    
    # Calculate overall scores
    avg_clarity = performance_summary.get("avg_clarity", 0)
    avg_depth = performance_summary.get("avg_depth", 0)
    avg_relevance = performance_summary.get("avg_relevance", 0)
    avg_communication = 0.0  # Separate from clarity — derived below from per-turn data

    score_ledger = build_score_ledger(transcript_history, evaluations)

    # Confidence weights: high=1.0, med=0.7, low=0.4
    _CONF_WEIGHTS = {"high": 1.0, "medium": 1.0, "med": 0.7, "low": 0.4}

    def _weighted_avg(vals_and_confs):
        """Compute confidence-weighted average from list of (value, confidence_str) tuples."""
        if not vals_and_confs:
            return 0.0
        total_w = sum(_CONF_WEIGHTS.get(c, 1.0) for _, c in vals_and_confs)
        if total_w == 0:
            return 0.0
        return sum(v * _CONF_WEIGHTS.get(c, 1.0) for v, c in vals_and_confs) / total_w

    # If running averages are missing, derive from turn evaluations directly.
    if evaluations and (avg_clarity + avg_depth + avg_relevance) <= 0:
        clarity_pairs = [
            (float(e.get("clarity_score", e.get("clarity")) or 0), e.get("confidence", "medium"))
            for e in evaluations
            if e.get("clarity_score", e.get("clarity")) is not None
        ]
        depth_pairs = [
            (float(e.get("depth_score", e.get("depth")) or 0), e.get("confidence", "medium"))
            for e in evaluations
            if e.get("depth_score", e.get("depth")) is not None
        ]
        relevance_pairs = [
            (float(e.get("relevance_score", e.get("relevance")) or 0), e.get("confidence", "medium"))
            for e in evaluations
            if e.get("relevance_score", e.get("relevance")) is not None
        ]

        if clarity_pairs:
            avg_clarity = _weighted_avg(clarity_pairs)
        if depth_pairs:
            avg_depth = _weighted_avg(depth_pairs)
        if relevance_pairs:
            avg_relevance = _weighted_avg(relevance_pairs)

    # Compute avg_communication from per-turn data (separate from clarity)
    if evaluations:
        comm_pairs = [
            (float(e.get("communication") or 0), e.get("confidence", "medium"))
            for e in evaluations
            if e.get("communication") is not None
        ]
        if comm_pairs:
            avg_communication = _weighted_avg(comm_pairs)
        else:
            # Fallback: estimate communication from filler density in rationale or use clarity
            avg_communication = avg_clarity * 0.9  # slight discount if no separate signal
    
    # Calculate overall score (0-100) with deterministic floor/ceiling.
    if capture_incomplete:
        overall_score = 0
    else:
        # Weight: clarity 25%, communication 20%, depth 30%, relevance 25%
        signal_sum = (avg_clarity * 0.25 + avg_communication * 0.20 + avg_depth * 0.30 + avg_relevance * 0.25)
        quality_multiplier = _score_quality_multiplier(evaluations)
        if signal_sum > 0:
            raw_score = int(round(signal_sum * 20 * quality_multiplier))
            score_floor = 20 if _has_credible_scoring_signal(evaluations) else 0
            overall_score = max(score_floor, min(100, raw_score))
        else:
            overall_score = 0
    
    # Build score breakdown
    def _score_0_100(value: float) -> int:
        return max(0, min(100, int(round(value))))

    scores = ScoreBreakdown(
        communication=0 if capture_incomplete else _score_0_100(avg_communication * 20),
        clarity=0 if capture_incomplete else _score_0_100(avg_clarity * 20),
        structure=0 if capture_incomplete else _score_0_100(_calculate_structure_score(evaluations)),
        technical_depth=(0 if capture_incomplete else _score_0_100(avg_depth * 20)) if interview_type in ["technical", "mixed"] else None,
        relevance=0 if capture_incomplete else _score_0_100(avg_relevance * 20)
    )
    
    # Build transcript messages
    transcript = []
    for qa in transcript_history:
        transcript.append(TranscriptMessage(
            speaker="Interviewer",
            text=qa["question"],
            timestamp=datetime.fromisoformat(qa["timestamp"])
        ))
        transcript.append(TranscriptMessage(
            speaker="You",
            text=qa["answer"],
            timestamp=datetime.fromisoformat(qa["timestamp"])
        ))
    
    # Generate recommendations
    recommendations = _generate_recommendations(evaluations, performance_summary, interview_type, session_state)
    if capture_incomplete:
        recommendations = [
            "Evaluation incomplete: candidate speech was not captured.",
            "Verify microphone permissions and selected input device.",
            "Retry interview and confirm transcript includes both interviewer and candidate turns.",
        ]
    
    # Get question index from session
    question_index = session_state.question_index if hasattr(session_state, 'question_index') else 0
    
    # Compute real metrics
    candidate_word_count = getattr(session_state, "candidate_word_count", None)
    interviewer_word_count = getattr(session_state, "interviewer_word_count", None)
    total_words = sum(len(msg.text.split()) for msg in transcript)
    if candidate_word_count is None:
        candidate_word_count = getattr(session_state, "total_words", None)
    if candidate_word_count is None:
        candidate_word_count = total_words
    if interviewer_word_count is None:
        interviewer_word_count = max(0, total_words - int(candidate_word_count))
    speaking_time = getattr(session_state, 'speaking_time', 0)
    silence_time = getattr(session_state, 'silence_time', 0)
    eye_contact_pct = getattr(session_state, 'eye_contact_pct', None)
    metrics = {
        'total_duration': duration_minutes,
        'questions_answered': question_index,
        'total_words': int(candidate_word_count),
        'candidate_word_count': int(candidate_word_count),
        'interviewer_word_count': int(interviewer_word_count),
        'speaking_time': speaking_time,
        'silence_time': silence_time,
        'eye_contact_pct': eye_contact_pct,
        'capture_status': "INCOMPLETE_NO_CANDIDATE_AUDIO" if capture_incomplete else "COMPLETE",
    }
    if capture_incomplete:
        metrics['evaluation_explainability'] = {
            'source': 'none_no_candidate_audio',
            'confidence': 'low',
            'turns_evaluated': 0,
            'formula': overall_score_formula_text(),
            'weights': overall_score_weight_summary(),
        }
    elif evaluations:
        confidence = "high" if len(evaluations) >= 3 else "medium"
        metrics['evaluation_explainability'] = {
            'source': 'session_evaluation_results',
            'confidence': confidence,
            'turns_evaluated': len(evaluations),
            'formula': overall_score_formula_text(),
            'weights': overall_score_weight_summary(),
            'quality_multiplier': round(_score_quality_multiplier(evaluations), 2),
            'credible_signal_present': _has_credible_scoring_signal(evaluations),
        }
    if evaluations:
        metrics['turn_evaluations'] = evaluations
        metrics['turn_eval_summary'] = {
            'turn_count': len(evaluations),
            'avg_clarity': round(avg_clarity, 2),
            'avg_communication': round(avg_communication, 2),
            'avg_depth': round(avg_depth, 2),
            'avg_relevance': round(avg_relevance, 2),
        }
    if score_ledger:
        metrics["score_ledger"] = score_ledger

    # Generate AI candidate feedback
    ai_feedback = None
    scores_for_ai = {
        "communication": scores.communication,
        "clarity": scores.clarity,
        "structure": scores.structure,
        "relevance": scores.relevance,
        "overall_score": overall_score
    }
    if capture_incomplete:
        ai_feedback = {
            "overall_summary": "The report could not produce a paid-grade evaluation because candidate speech was not captured reliably enough for scoring.",
            "strengths": [],
            "areas_for_improvement": [
                "Grant microphone permission in the browser and confirm the active input device.",
                "Verify live transcript capture before continuing past the first answer.",
                "Re-run the interview only after both audio capture and transcript visibility are stable.",
            ],
        }
    else:
        try:
            from services.llm.chains.candidate_feedback import generate_candidate_feedback
            transcript_for_ai = [{"speaker": msg.speaker, "text": msg.text} for msg in transcript]
            ai_feedback = generate_candidate_feedback(
                transcript=transcript_for_ai,
                scores=scores_for_ai,
                interview_type=interview_type,
                duration_minutes=duration_minutes
            )
        except Exception as e:
            print(f"⚠️ Failed to generate AI feedback: {e}")
        if not isinstance(ai_feedback, dict) or not ai_feedback:
            ai_feedback = _build_deterministic_feedback(scores_for_ai, evaluations=evaluations, interview_type=interview_type)

    # ─── v2: Per-question turn analyses ───────────────────────────────────────
    turn_analyses: List[TurnAnalysis] = []
    competency_scores: Dict[str, int] = {}
    improvement_roadmap: List[ImprovementItem] = []
    hiring_recommendation = None
    score_context = None

    if not capture_incomplete and transcript_history and not skip_v2:
        turn_analyses = _build_turn_analyses(
            transcript_history=transcript_history,
            evaluations=evaluations,
            interview_type=interview_type,
        )

        # Competency scores
        try:
            from services.interview.competency_map import aggregate_competency_scores, COMPETENCY_KEYS
            competency_scores = aggregate_competency_scores(
                [{"competency": t.competency, "score_0_100": t.score_0_100} for t in turn_analyses]
            )
            # Build score_context string
            if competency_scores:
                best_comp = max(competency_scores, key=lambda k: competency_scores[k])
                worst_comp = min(competency_scores, key=lambda k: competency_scores[k])
                score_context = (
                    f"The clearest strength was {best_comp.replace('_', ' ')} at {competency_scores[best_comp]}/100. "
                    f"The main development area was {worst_comp.replace('_', ' ')} at {competency_scores[worst_comp]}/100."
                )
        except Exception as e:
            print(f"⚠️ Competency aggregation failed: {e}")

        # Hiring recommendation
        try:
            from services.interview.hiring_signal import compute_hiring_signal
            hiring_raw = compute_hiring_signal(
                overall_score=overall_score,
                turn_analyses=[t.model_dump() for t in turn_analyses],
                competency_scores=competency_scores,
                interview_type=interview_type,
            )
            hiring_recommendation = HiringRecommendation(**hiring_raw)
        except Exception as e:
            print(f"⚠️ Hiring signal computation failed: {e}")

        # Improvement roadmap
        improvement_roadmap = _build_improvement_roadmap(
            turn_analyses=turn_analyses,
            competency_scores=competency_scores,
            ai_feedback=ai_feedback,
            interview_type=interview_type,
        )

    # Create report
    report = InterviewReport(
        id=str(uuid.uuid4()),
        user_id="",
        title=f"{interview_type.capitalize()} Interview - {datetime.now().strftime('%B %d, %Y')}",
        date=datetime.now(),
        type=interview_type.capitalize(),
        mode="Voice-Only Realtime",
        duration=f"{duration_minutes} minutes",
        overall_score=overall_score,
        scores=scores,
        transcript=transcript,
        recommendations=recommendations,
        questions=question_index,
        is_sample=False,
        metrics=metrics,
        ai_feedback=ai_feedback,
        competency_scores=competency_scores or None,
        score_context=score_context,
        turn_analyses=turn_analyses or None,
        improvement_roadmap=improvement_roadmap or None,
        hiring_recommendation=hiring_recommendation,
    )

    return report


def enrich_v2_fields(
    session_state: Any,
    interview_type: str,
    overall_score: int,
    ai_feedback: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compute v2 enrichment fields (turn analyses, competency scores, hiring signal,
    improvement roadmap) without rerunning the full report generation.

    Returns a dict suitable for merging into the metrics JSON blob stored in DB.
    All keys are prefixed with 'v2_' to avoid collisions.
    """
    evaluations = session_state.evaluation_results if hasattr(session_state, 'evaluation_results') else []
    transcript_history = session_state.transcript_history if hasattr(session_state, 'transcript_history') else []
    candidate_answers = [
        (item.get("answer") or "").strip()
        for item in transcript_history
        if isinstance(item, dict) and (item.get("answer") or "").strip()
    ]
    if not candidate_answers:
        return {"v2_enrichment_status": "skipped_no_audio"}

    turn_analyses = _build_turn_analyses(
        transcript_history=transcript_history,
        evaluations=evaluations,
        interview_type=interview_type,
    )

    competency_scores: Dict[str, int] = {}
    score_context: Optional[str] = None
    try:
        from services.interview.competency_map import aggregate_competency_scores
        competency_scores = aggregate_competency_scores(
            [{"competency": t.competency, "score_0_100": t.score_0_100} for t in turn_analyses]
        )
        if competency_scores:
            best_comp = max(competency_scores, key=lambda k: competency_scores[k])
            worst_comp = min(competency_scores, key=lambda k: competency_scores[k])
            score_context = (
                f"The clearest strength was {best_comp.replace('_', ' ')} at {competency_scores[best_comp]}/100. "
                f"The main development area was {worst_comp.replace('_', ' ')} at {competency_scores[worst_comp]}/100."
            )
    except Exception as e:
        print(f"⚠️ V2 enrichment competency aggregation failed: {e}")

    hiring_recommendation = None
    try:
        from services.interview.hiring_signal import compute_hiring_signal
        hiring_raw = compute_hiring_signal(
            overall_score=overall_score,
            turn_analyses=[t.model_dump() for t in turn_analyses],
            competency_scores=competency_scores,
            interview_type=interview_type,
        )
        hiring_recommendation = hiring_raw
    except Exception as e:
        print(f"⚠️ V2 enrichment hiring signal failed: {e}")

    improvement_roadmap = _build_improvement_roadmap(
        turn_analyses=turn_analyses,
        competency_scores=competency_scores,
        ai_feedback=ai_feedback or {},
        interview_type=interview_type,
    )

    return {
        "v2_enrichment_status": "complete",
        "v2_turn_analyses": [t.model_dump() for t in turn_analyses],
        "v2_competency_scores": competency_scores,
        "v2_score_context": score_context,
        "v2_hiring_recommendation": hiring_recommendation,
        "v2_improvement_roadmap": [item.model_dump() for item in improvement_roadmap],
    }


def _build_turn_analyses(
    transcript_history: List[Dict[str, Any]],
    evaluations: List[Dict[str, Any]],
    interview_type: str,
) -> List[TurnAnalysis]:
    """Build per-question TurnAnalysis objects with competency, STAR, evidence."""
    try:
        from services.interview.competency_map import get_competency_for_question
        from services.interview.star_extractor import extract_star, star_score_0_100
        from services.interview.deterministic_rubric_evaluator import (
            evaluate_turn as det_evaluate_turn,
            extract_depth_signals,
        )
    except Exception:
        try:
            from backend.services.interview.competency_map import get_competency_for_question
            from backend.services.interview.star_extractor import extract_star, star_score_0_100
            from backend.services.interview.deterministic_rubric_evaluator import (
                evaluate_turn as det_evaluate_turn,
                extract_depth_signals,
            )
        except Exception:
            return []

    analyses: List[TurnAnalysis] = []
    evals_by_turn: Dict[int, Dict] = {
        e.get("turn_id", i + 1): e for i, e in enumerate(evaluations or [])
    }

    for idx, qa in enumerate(transcript_history):
        if not isinstance(qa, dict):
            continue
        question = (qa.get("question") or "").strip()
        answer = (qa.get("answer") or "").strip()
        if not answer:
            continue

        # Skip answers that are too short to be meaningful (likely echo artifacts or noise)
        answer_words = [w for w in answer.split() if len(w) > 1]
        if len(answer_words) < 8:
            continue

        # Skip answers that look like echoes of the question (≥60% word overlap)
        if question:
            q_words = set(w.lower() for w in question.split() if len(w) > 2)
            a_words = set(w.lower() for w in answer.split() if len(w) > 2)
            if q_words and len(a_words) > 0 and len(q_words & a_words) / len(a_words) >= 0.60:
                continue

        turn_id = idx + 1
        eval_data = evals_by_turn.get(turn_id, {})

        # Competency
        topic_tags = qa.get("topic_tags") or []
        competency = get_competency_for_question(
            question_id=qa.get("question_id"),
            topic_tags=topic_tags,
            domain=qa.get("domain"),
            interview_type=interview_type,
        )

        # Rubric scores (use existing eval_data or re-evaluate)
        clarity = float(eval_data.get("clarity") or det_evaluate_turn(
            question_text=question,
            candidate_answer_text=answer,
            interview_type=interview_type,
        ).get("clarity", 3))
        depth = float(eval_data.get("depth") or 3)
        relevance = float(eval_data.get("relevance") or 3)
        communication = float(eval_data.get("communication") or 3)

        # Convert 1-5 rubric to 0-100
        raw = (clarity * 0.25 + communication * 0.20 + depth * 0.30 + relevance * 0.25) * 20
        score_0_100 = max(0, min(100, int(round(raw))))

        # STAR extraction
        star_raw = extract_star(answer)
        star_breakdown = StarBreakdown(
            situation=star_raw.get("situation", {}).get("detected", False),
            task=star_raw.get("task", {}).get("detected", False),
            action=star_raw.get("action", {}).get("detected", False),
            result=star_raw.get("result", {}).get("detected", False),
            situation_snippet=star_raw.get("situation", {}).get("snippet"),
            task_snippet=star_raw.get("task", {}).get("snippet"),
            action_snippet=star_raw.get("action", {}).get("snippet"),
            result_snippet=star_raw.get("result", {}).get("snippet"),
            source=star_raw.get("source", "keyword_fallback"),
        )

        # Depth signals
        depth_sigs = eval_data.get("depth_signals") or extract_depth_signals(answer, interview_type)

        # Evidence quote: pick best sentence (longest sentence with ≥1 metric or ownership signal)
        evidence_quote = _extract_evidence_quote(answer, depth_sigs)

        # One-line feedback
        one_line = _one_line_feedback(
            score_0_100=score_0_100,
            competency=competency,
            star_breakdown=star_breakdown,
            depth_signals=depth_sigs,
            interview_type=interview_type,
        )

        analyses.append(TurnAnalysis(
            turn_id=turn_id,
            question_text=question[:300],
            competency=competency,
            score_0_100=score_0_100,
            star_breakdown=star_breakdown,
            evidence_quote=evidence_quote,
            one_line_feedback=one_line,
            depth_signals=depth_sigs,
        ))

    return analyses


def _extract_evidence_quote(answer: str, depth_signals: Dict) -> Optional[str]:
    """Pick the most evidential sentence from an answer."""
    import re
    sentences = [s.strip() for s in re.split(r"[.!?]+", answer) if len(s.strip()) > 20]
    if not sentences:
        return answer[:200] if answer else None

    metrics = depth_signals.get("metrics_mentioned", []) if depth_signals else []
    ownership_signals = depth_signals.get("ownership_signals", 0) if depth_signals else 0
    impact_signals = depth_signals.get("impact_signals", 0) if depth_signals else 0

    def _sentence_score(s: str) -> int:
        sl = s.lower()
        score = 0
        for m in metrics:
            if m in sl:
                score += 3
        ownership_verbs = ["i led", "i built", "i designed", "i implemented", "i developed", "i created"]
        impact_verbs = ["reduced", "improved", "increased", "delivered", "shipped", "achieved"]
        score += sum(2 for v in ownership_verbs if v in sl)
        score += sum(2 for v in impact_verbs if v in sl)
        score += min(3, len(s.split()) // 10)
        return score

    best = max(sentences, key=_sentence_score)
    return best[:250] if len(best) > 250 else best


def _one_line_feedback(
    score_0_100: int,
    competency: str,
    star_breakdown: StarBreakdown,
    depth_signals: Dict,
    interview_type: str,
) -> str:
    """Generate a one-sentence, evidence-based feedback for a single turn."""
    comp_label = competency.replace("_", " ")
    metrics = (depth_signals or {}).get("metrics_mentioned", [])
    ownership = (depth_signals or {}).get("ownership_signals", 0)

    if score_0_100 >= 80:
        if metrics:
            return f"Strong {comp_label} response — used quantified evidence ({metrics[0]}) to demonstrate impact."
        if ownership >= 2:
            return f"Clear ownership language and specific actions make this a strong {comp_label} answer."
        return f"Well-structured {comp_label} answer with good specificity and delivery."

    if score_0_100 >= 60:
        missing = [c for c in ("situation", "task", "action", "result") if not getattr(star_breakdown, c, False)]
        if missing:
            return f"Good start on {comp_label} — add the missing '{missing[0]}' component to complete the STAR structure."
        if not metrics:
            return f"Solid {comp_label} answer; quantifying the outcome with a number or % would strengthen it further."
        return f"Competent {comp_label} answer — adding more specific context would boost the score."

    missing_all = [c for c in ("situation", "task", "action", "result") if not getattr(star_breakdown, c, False)]
    if len(missing_all) >= 3:
        return f"This {comp_label} answer needs more structure — aim to cover Situation, Action, and Result clearly."
    if not metrics and not ownership:
        return f"Add specifics: mention what you personally did and what the measurable result was."
    return f"Short or off-topic response — expand with concrete details about your role and the outcome."


def _build_improvement_roadmap(
    turn_analyses: List[TurnAnalysis],
    competency_scores: Dict[str, int],
    ai_feedback: Optional[Dict],
    interview_type: str,
) -> List[ImprovementItem]:
    """Build a structured improvement roadmap from turn analyses and scores."""
    items: List[ImprovementItem] = []
    seen_competencies: set = set()

    if not turn_analyses:
        return items

    # 1. Find weakest competency with actual turns
    sorted_comps = sorted(
        [(comp, score) for comp, score in (competency_scores or {}).items() if score > 0],
        key=lambda x: x[1]
    )
    for comp, score in sorted_comps[:3]:
        if comp in seen_competencies:
            continue
        seen_competencies.add(comp)
        comp_turns = [t for t in turn_analyses if t.competency == comp]
        if not comp_turns:
            continue
        worst_turn = min(comp_turns, key=lambda t: t.score_0_100)

        # Generate specific finding
        finding = f"Scored {score}/100 on {comp.replace('_', ' ')} — "
        depth_sigs = worst_turn.depth_signals or {}
        if not worst_turn.star_breakdown or not worst_turn.star_breakdown.result:
            finding += "answers lacked quantified results."
        elif not depth_sigs.get("ownership_signals", 0):
            finding += "personal contributions were not clearly stated."
        else:
            finding += "responses lacked specificity and concrete examples."

        # Suggested action
        action_map = {
            "communication": "Practice speaking in complete declarative sentences. Record mock answers and listen for filler/hedge words.",
            "problem_solving": "Walk through your reasoning step-by-step: state the problem, your approach, trade-offs considered, and your decision.",
            "technical_depth": "Go beyond naming technologies — explain why you chose them, how you configured them, and what the outcome was.",
            "ownership": "Use 'I' statements: 'I led', 'I decided', 'I delivered'. Show your direct contribution, not just the team's work.",
            "collaboration": "Describe how you involved others, handled disagreement, or influenced people who didn't report to you.",
            "adaptability": "Frame change as an opportunity: what you learned, how you adjusted your approach, and how it made you better.",
        }
        suggested_action = action_map.get(comp, "Add concrete, specific examples with measurable outcomes.")

        # Example reframe from worst turn
        example_reframe = None
        if worst_turn.evidence_quote:
            eq = worst_turn.evidence_quote[:120]
            if comp == "ownership" and "we" in eq.lower():
                example_reframe = f'Instead of "We did X", try "I designed X, and coordinated with the team to implement it"'
            elif not worst_turn.star_breakdown or not worst_turn.star_breakdown.result:
                example_reframe = f'Close your answer with a result: "As a result, we reduced [metric] by [X]%"'

        items.append(ImprovementItem(
            competency=comp,
            finding=finding,
            suggested_action=suggested_action,
            example_reframe=example_reframe,
        ))

    # 2. STAR structure gap (cross-cutting)
    if interview_type in ("behavioral", "mixed"):
        zero_result_turns = [
            t for t in turn_analyses
            if t.star_breakdown and not t.star_breakdown.result
        ]
        if len(zero_result_turns) >= max(1, len(turn_analyses) // 2) and "problem_solving" not in seen_competencies:
            items.append(ImprovementItem(
                competency="problem_solving",
                finding=f"Result component missing in {len(zero_result_turns)}/{len(turn_analyses)} answers — outcomes are the most memorable part of any answer.",
                suggested_action="Always close your answer with a concrete result. Use: 'As a result, [metric] improved by [X]' or 'The team delivered [outcome] on time'.",
                example_reframe='Try: "As a result, we reduced onboarding time from 2 weeks to 3 days and improved retention by 20%"',
            ))

    return items[:5]
    """Generate a minimal report when session_state is not available."""
    metrics = {
        'total_duration': duration_minutes,
        'questions_answered': 0,
        'total_words': 0,
        'speaking_time': 0,
        'silence_time': 0,
        'eye_contact_pct': None,
    }
    return InterviewReport(
        id=str(uuid.uuid4()),
        user_id="",
        title=f"{interview_type.capitalize()} Interview - {datetime.now().strftime('%B %d, %Y')}",
        date=datetime.now(),
        type=interview_type.capitalize(),
        mode="Voice-Only Realtime",
        duration=f"{duration_minutes} minutes",
        overall_score=50,
        scores=ScoreBreakdown(
            communication=50,
            clarity=50,
            structure=50,
            technical_depth=50 if interview_type in ["technical", "mixed"] else None,
            relevance=50
        ),
        transcript=[],
        recommendations=["Interview completed. Detailed analysis not available."],
        questions=0,
        is_sample=False,
        metrics=metrics,
        ai_feedback=_build_deterministic_feedback({"overall_score": 50})
    )


def _build_deterministic_feedback(scores: Dict[str, int], evaluations: List[Dict[str, Any]] = None, interview_type: str = "behavioral") -> Dict[str, Any]:
    """Build feedback grounded in actual transcript content, not just score tiers."""
    overall = int(scores.get("overall_score", 50) or 50)
    communication = int(scores.get("communication", overall) or overall)
    clarity = int(scores.get("clarity", overall) or overall)
    relevance = int(scores.get("relevance", overall) or overall)

    evals = evaluations or []

    # Extract best answer excerpt
    best_excerpt = ""
    best_turn_depth = 0
    for e in evals:
        d = e.get("depth") or e.get("depth_score") or 0
        if d > best_turn_depth and e.get("evidence_excerpt"):
            best_turn_depth = d
            best_excerpt = e["evidence_excerpt"]

    # Detect STAR usage across turns
    star_totals = {"situation": 0, "task": 0, "action": 0, "result": 0}
    for e in evals:
        sc = e.get("star_completeness") or {}
        for k in star_totals:
            if sc.get(k):
                star_totals[k] += 1
    n_turns = max(len(evals), 1)
    star_coverage = {k: round(v / n_turns * 100) for k, v in star_totals.items()}

    # Build rationale-grounded strengths
    strengths = []
    areas = []

    # Communication assessment
    if communication >= 75:
        strengths.append("Delivery was composed and direct, with minimal filler language diluting the message.")
    elif communication >= 55:
        areas.append("Trim hedging phrases such as 'I think' or 'maybe' so the answer lands with more authority.")
    else:
        areas.append("Communication weakened the interview because filler and hedging language obscured otherwise usable content.")

    # Clarity assessment
    if clarity >= 75:
        strengths.append("Answers were structured clearly enough to follow without rework from the listener.")
    elif clarity < 50:
        areas.append("Sentence control needs tightening. Shorter, cleaner statements will improve clarity and executive presence.")

    # Structure / STAR assessment
    missing_star = [k for k, pct in star_coverage.items() if pct < 40]
    present_star = [k for k, pct in star_coverage.items() if pct >= 60]
    if present_star:
        strengths.append(f"Behavioral structure was visible in the strongest answers, with clear STAR elements around {', '.join(present_star)}.")
    if missing_star:
        areas.append(
            f"Behavioral coverage was incomplete: {', '.join(missing_star)} were missing in too many answers. "
            "State the context quickly, then make your action and measurable result unmistakable."
        )

    # Relevance assessment
    if relevance >= 75:
        strengths.append("Answers stayed aligned to the question instead of drifting into generic commentary.")
    elif relevance < 55:
        areas.append("Some answers drifted away from the prompt. A short pause before answering would improve precision.")

    # Best answer excerpt
    best_excerpt_note = ""
    if best_excerpt:
        best_excerpt_note = (
            f'Best evidence captured: "{best_excerpt[:120]}…"' if len(best_excerpt) > 120 else f'Best evidence captured: "{best_excerpt}"'
        )

    # Summary
    if overall >= 80:
        summary = (
            f"This was a strong interview with credible, hire-ready evidence ({overall}/100). "
            "The candidate communicated with control, stayed close to the question, and supported the score with concrete execution detail."
        )
    elif overall >= 60:
        summary = (
            f"The interview showed credible fundamentals ({overall}/100), but the evidence was still uneven in places. "
            "Sharper examples, cleaner structure, and more defended impact would move this into a stronger band."
        )
    elif overall > 0:
        summary = (
            f"The interview produced some usable signal ({overall}/100), but not enough high-quality evidence for a premium-grade recommendation. "
            "Answers need clearer ownership, tighter structure, and more measurable outcomes."
        )
    else:
        summary = "The session could not be scored to paid-report standard because reliable candidate evidence was not captured."

    if best_excerpt_note and overall > 0:
        summary += f" {best_excerpt_note}"

    # Standard improvement tips
    standard_tips = [
        "Prepare 4 to 5 board-ready stories covering leadership, conflict, failure, cross-team execution, and one signature win.",
        "Open each answer with fast context so the interviewer understands the business situation immediately.",
        "Close every answer with a result that can be defended: a metric, a timeline, or a concrete operational outcome.",
        "Record mock answers and review them for filler density, weak openings, and unclear ownership language.",
    ]
    if interview_type in ["technical", "mixed"]:
        standard_tips.append("For technical questions, state assumptions first, walk through tradeoffs, and then land on a recommendation.")

    return {
        "overall_summary": summary,
        "strengths": strengths if strengths else ["The session produced enough engagement to evaluate, but no single strength clearly dominated the interview."],
        "areas_for_improvement": areas if areas else [
            "Use a disciplined STAR structure instead of general commentary.",
            "Add concrete examples with measurable outcomes and visible ownership.",
            "State assumptions, tradeoffs, and decisions explicitly rather than implying them.",
        ],
        "communication_feedback": (
            "Delivery supported the content: clear, controlled, and credible." if communication >= 75
            else "Tighten delivery with shorter declarative sentences and less hedging so the message sounds deliberate."
        ),
        "content_feedback": (
            "The answer content carried enough depth and specificity to feel credible." if clarity >= 70 and relevance >= 70
            else "Increase content quality with concrete project context, constraints, decisions, and defended impact metrics."
        ),
        "tips_for_next_interview": standard_tips,
    }


def _calculate_structure_score(evaluations: List[Dict[str, Any]]) -> int:
    """Calculate structure score based on STAR completeness and organization."""
    if not evaluations:
        return 60
    
    star_scores = []
    for eval_result in evaluations:
        star = eval_result.get("star_completeness", {})
        if star:
            completeness = sum(1 for v in star.values() if v) / len(star)
            star_scores.append(completeness * 100)
    
    if star_scores:
        return int(sum(star_scores) / len(star_scores))
    else:
        # Fallback: use clarity as proxy for structure.
        clarity_scores = [
            (e.get("clarity_score") if e.get("clarity_score") is not None else e.get("clarity", 3)) * 20
            for e in evaluations
        ]
        return int(sum(clarity_scores) / len(clarity_scores)) if clarity_scores else 60


def _generate_recommendations(
    evaluations: List[Dict[str, Any]],
    performance_summary: Dict[str, Any],
    interview_type: str,
    session_state: Any = None
) -> List[str]:
    """Generate actionable recommendations based on evaluation results."""
    recommendations = []
    
    # Analyze patterns
    clarity_scores = [e.get("clarity_score", e.get("clarity", 3)) for e in evaluations]
    depth_scores = [e.get("depth_score", e.get("depth", 3)) for e in evaluations]
    relevance_scores = [e.get("relevance_score", e.get("relevance", 3)) for e in evaluations]
    
    # Analyze gaze metrics if available
    gaze_metrics = []
    if session_state and hasattr(session_state, 'gaze_metrics'):
        gaze_metrics = session_state.gaze_metrics
    
    if gaze_metrics:
        avg_eye_contact = sum(g.get("eye_contact_pct", 0) for g in gaze_metrics) / len(gaze_metrics) if gaze_metrics else 0
        total_away_events = sum(g.get("away_events", 0) for g in gaze_metrics)
        max_away_duration = max((g.get("longest_away_duration", 0) for g in gaze_metrics), default=0)
        
        # Eye contact recommendations
        if avg_eye_contact < 70:
            recommendations.append(
                f"Eye contact averaged {int(avg_eye_contact)}% against a target above 70%. Raise the camera to eye level and keep note-checking brief."
            )
        
        if total_away_events > len(gaze_metrics) * 2:
            recommendations.append(
                f"Frequent gaze breaks were detected ({total_away_events} events). Reduce off-screen attention and return to the camera more deliberately."
            )
        
        if max_away_duration > 5000:  # 5 seconds
            recommendations.append(
                "Extended gaze breaks were detected. Brief note checks are fine, but sustained off-camera focus weakens presence."
            )
    
    avg_clarity = sum(clarity_scores) / len(clarity_scores) if clarity_scores else 3
    avg_depth = sum(depth_scores) / len(depth_scores) if depth_scores else 3
    avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 3
    
    # Clarity recommendations
    if avg_clarity < 3:
        recommendations.append(
            "Reduce filler words and hesitation so the answer sounds more deliberate and interview-ready."
        )
    
    # Depth recommendations
    if avg_depth < 3:
        if interview_type in ["behavioral", "mixed"]:
            recommendations.append(
                "Add more operating detail to behavioral answers and use STAR with a visible result at the end."
            )
        else:
            recommendations.append(
                "Increase technical depth by naming the system choices, tradeoffs, and implementation details behind your answer."
            )
    
    # Relevance recommendations
    if avg_relevance < 3:
        recommendations.append(
            "Answer the exact question first, then expand. Precision matters more than volume."
        )
    
    # STAR method recommendations
    if interview_type in ["behavioral", "mixed"]:
        missing_results = sum(1 for e in evaluations if e.get("star_completeness", {}).get("result") == False)
        if missing_results > len(evaluations) / 2:
            recommendations.append(
                "Too many behavioral answers ended without a defended result. Quantify the outcome whenever possible."
            )
    
    # Pause and pace recommendations
    pause_count = performance_summary.get("pause_count", 0)
    if pause_count > len(evaluations) * 2:
        recommendations.append(
            "Reduce pause clutter and filler density. Smoother delivery will materially improve executive presence."
        )
    
    # Confidence recommendations
    confidence_dist = performance_summary.get("confidence_distribution", {})
    low_conf = confidence_dist.get("low", 0)
    if low_conf > len(evaluations) / 2:
        recommendations.append(
            "Speak with more conviction. Replace hedge phrases with direct statements and defend the decision you made."
        )
    
    # Technical recommendations
    if interview_type in ["technical", "mixed"]:
        tech_scores = [e.get("technical_correctness", "med") for e in evaluations if "technical_correctness" in e]
        if tech_scores and tech_scores.count("low") > len(tech_scores) / 2:
            recommendations.append(
                "Strengthen technical command in core areas and practice explaining them with concrete implementation language."
            )
    
    # If no specific issues, provide general positive feedback
    if not recommendations:
        recommendations.append(
            "Overall performance was credible. The next gain comes from sharper examples, cleaner structure, and more explicit impact."
        )
    
    return recommendations[:5]  # Limit to top 5 recommendations


def _generate_minimal_report(interview_type: str, duration_minutes: int) -> InterviewReport:
    """Return an empty/zero report when session state is unavailable."""
    return InterviewReport(
        id=str(uuid.uuid4()),
        user_id="",
        title=f"{interview_type.capitalize()} Interview",
        date=datetime.now(),
        type=interview_type.capitalize(),
        mode="Voice-Only Realtime",
        duration=f"{duration_minutes} minutes",
        overall_score=0,
        scores=ScoreBreakdown(
            communication=0,
            clarity=0,
            structure=0,
            relevance=0,
            technical_depth=0,
        ),
        transcript=[],
        metrics={"capture_status": "MISSING_SESSION_STATE"},
        recommendations=["Session data was not available. Please retry the interview."],
    )
