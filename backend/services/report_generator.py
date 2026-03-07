"""Report generation service for interview sessions."""

from typing import Dict, List, Any
from datetime import datetime
import uuid
from models.interview import InterviewReport, TranscriptMessage, ScoreBreakdown


def generate_report(
    session_state: Any,  # InterviewState
    interview_type: str,
    duration_minutes: int
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
        if signal_sum > 0:
            raw_score = int(round(signal_sum * 20))
            overall_score = max(20, min(100, raw_score))
        else:
            overall_score = 40
    
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
            'formula': 'overall = avg(clarity, depth, relevance) * 20',
        }
    elif evaluations:
        confidence = "high" if len(evaluations) >= 3 else "medium"
        metrics['evaluation_explainability'] = {
            'source': 'session_evaluation_results',
            'confidence': confidence,
            'turns_evaluated': len(evaluations),
            'formula': 'overall = avg(clarity, depth, relevance) * 20',
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
            "overall_summary": "Evaluation incomplete because candidate speech was not captured.",
            "strengths": [],
            "areas_for_improvement": [
                "Grant microphone permission in browser settings",
                "Confirm correct microphone input device",
                "Re-run interview and verify live transcription before ending",
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

    # Create report
    report = InterviewReport(
        id=str(uuid.uuid4()),  # Generate new ID for report (different from session_id)
        user_id="",  # Will be set by caller
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
        ai_feedback=ai_feedback
    )

    return report


def _generate_minimal_report(interview_type: str, duration_minutes: int) -> InterviewReport:
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
    structure_score = int(scores.get("structure", overall) or overall)
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
        strengths.append("Confident delivery with low filler word usage — answers came across as polished and direct.")
    elif communication >= 55:
        areas.append("Reduce hedging phrases (e.g., 'I think', 'sort of', 'I guess') to sound more assertive and confident.")
    else:
        areas.append("Communication needs work: high filler/hedging density detected. Practice speaking in complete, assertive sentences.")

    # Clarity assessment
    if clarity >= 75:
        strengths.append("Well-structured sentences with appropriate length and pacing.")
    elif clarity < 50:
        areas.append("Shorten overly long sentences and avoid run-ons. Aim for 20–30 words per sentence for maximum clarity.")

    # Structure / STAR assessment
    missing_star = [k for k, pct in star_coverage.items() if pct < 40]
    present_star = [k for k, pct in star_coverage.items() if pct >= 60]
    if present_star:
        strengths.append(f"Used STAR components effectively: {', '.join(present_star)} detected in most answers.")
    if missing_star:
        areas.append(
            f"STAR coverage gaps: '{', '.join(missing_star)}' components were missing in many answers. "
            "Add explicit Situation/Task context and close each answer with a measurable Result."
        )

    # Relevance assessment
    if relevance >= 75:
        strengths.append("Answers stayed on-topic and addressed what was asked directly.")
    elif relevance < 55:
        areas.append("Some answers drifted off-topic. Pause briefly to confirm you understand the question before answering.")

    # Best answer excerpt
    best_excerpt_note = ""
    if best_excerpt:
        best_excerpt_note = f'Your strongest answer excerpt: "{best_excerpt[:120]}…"' if len(best_excerpt) > 120 else f'Your strongest answer excerpt: "{best_excerpt}"'

    # Summary
    if overall >= 80:
        summary = f"Strong performance overall (score: {overall}/100). Delivery was confident and answers were structured well."
    elif overall >= 60:
        summary = f"Solid interview fundamentals (score: {overall}/100) with clear room to deepen answers and sharpen communication."
    elif overall > 0:
        summary = f"Interview captured with room to grow (score: {overall}/100). Focus on STAR structure and reducing fillers."
    else:
        summary = "Evaluation incomplete: not enough candidate speech was captured to score this session."

    if best_excerpt_note and overall > 0:
        summary += f" {best_excerpt_note}"

    # Standard improvement tips
    standard_tips = [
        "Prepare 4–5 STAR stories: leadership, conflict, failure, cross-team delivery, and a technical win.",
        "Open each answer with the Situation in 1–2 sentences to set context immediately.",
        "Close every answer with a concrete Result: numbers, timelines, or team impact work best.",
        "Record yourself answering mock questions and listen back for filler density.",
    ]
    if interview_type in ["technical", "mixed"]:
        standard_tips.append("For technical questions: state your assumptions, walk through tradeoffs, then give your final recommendation.")

    return {
        "overall_summary": summary,
        "strengths": strengths if strengths else ["Baseline engagement and participation throughout the session."],
        "areas_for_improvement": areas if areas else [
            "Use STAR format for behavioral answers",
            "Add concrete examples with measurable outcomes",
            "State assumptions and tradeoffs more explicitly",
        ],
        "communication_feedback": (
            "Delivery was clean and confident." if communication >= 75
            else "Reduce hedging and filler words. Aim for direct, declarative sentences with clear beginnings and ends."
        ),
        "content_feedback": (
            "Good depth and specificity in answers." if clarity >= 70 and relevance >= 70
            else "Increase depth with concrete project details, constraints, decisions, and impact metrics."
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
                f"Eye contact: {int(avg_eye_contact)}% (target: >70%). Practice maintaining focus on the camera lens. Position your camera at eye level and use notes sparingly."
            )
        
        if total_away_events > len(gaze_metrics) * 2:
            recommendations.append(
                f"Frequent looking away detected ({total_away_events} events). Try to maintain eye contact with the camera throughout your answers. Consider positioning your camera at eye level and minimizing distractions."
            )
        
        if max_away_duration > 5000:  # 5 seconds
            recommendations.append(
                "Long periods of looking away detected. Practice maintaining consistent eye contact. Use brief glances at notes if needed, but return focus to the camera quickly."
            )
    
    avg_clarity = sum(clarity_scores) / len(clarity_scores) if clarity_scores else 3
    avg_depth = sum(depth_scores) / len(depth_scores) if depth_scores else 3
    avg_relevance = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 3
    
    # Clarity recommendations
    if avg_clarity < 3:
        recommendations.append(
            "Work on reducing fillers (um, uh) and pauses. Practice speaking more smoothly and confidently."
        )
    
    # Depth recommendations
    if avg_depth < 3:
        if interview_type in ["behavioral", "mixed"]:
            recommendations.append(
                "Add more specific details and examples to your answers. Use the STAR method (Situation, Task, Action, Result) to structure responses."
            )
        else:
            recommendations.append(
                "Provide more technical depth in your answers. Include specific technologies, algorithms, or design patterns when relevant."
            )
    
    # Relevance recommendations
    if avg_relevance < 3:
        recommendations.append(
            "Ensure your answers directly address the question asked. Take a moment to understand the question before responding."
        )
    
    # STAR method recommendations
    if interview_type in ["behavioral", "mixed"]:
        missing_results = sum(1 for e in evaluations if e.get("star_completeness", {}).get("result") == False)
        if missing_results > len(evaluations) / 2:
            recommendations.append(
                "Focus on including results and impact in your behavioral answers. Quantify outcomes when possible (e.g., 'reduced time by 30%', 'improved user satisfaction')."
            )
    
    # Pause and pace recommendations
    pause_count = performance_summary.get("pause_count", 0)
    if pause_count > len(evaluations) * 2:
        recommendations.append(
            "Reduce the number of pauses and filler words. Practice speaking more continuously while maintaining clarity."
        )
    
    # Confidence recommendations
    confidence_dist = performance_summary.get("confidence_distribution", {})
    low_conf = confidence_dist.get("low", 0)
    if low_conf > len(evaluations) / 2:
        recommendations.append(
            "Work on speaking with more confidence. Avoid hedging phrases like 'I think' or 'maybe'. State your points assertively."
        )
    
    # Technical recommendations
    if interview_type in ["technical", "mixed"]:
        tech_scores = [e.get("technical_correctness", "med") for e in evaluations if "technical_correctness" in e]
        if tech_scores and tech_scores.count("low") > len(tech_scores) / 2:
            recommendations.append(
                "Strengthen your technical knowledge. Review core concepts and practice explaining technical topics clearly."
            )
    
    # If no specific issues, provide general positive feedback
    if not recommendations:
        recommendations.append(
            "Good overall performance! Continue practicing to refine your communication and add more depth to your answers."
        )
    
    return recommendations[:5]  # Limit to top 5 recommendations
