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

    # If running averages are missing, derive from turn evaluations directly.
    if evaluations and (avg_clarity + avg_depth + avg_relevance) <= 0:
        clarity_vals = [e.get("clarity_score", e.get("clarity")) for e in evaluations if e.get("clarity_score", e.get("clarity")) is not None]
        depth_vals = [e.get("depth_score", e.get("depth")) for e in evaluations if e.get("depth_score", e.get("depth")) is not None]
        relevance_vals = [e.get("relevance_score", e.get("relevance")) for e in evaluations if e.get("relevance_score", e.get("relevance")) is not None]

        if clarity_vals:
            avg_clarity = float(sum(clarity_vals) / len(clarity_vals))
        if depth_vals:
            avg_depth = float(sum(depth_vals) / len(depth_vals))
        if relevance_vals:
            avg_relevance = float(sum(relevance_vals) / len(relevance_vals))
    
    # Calculate overall score (0-100)
    overall_score = int((avg_clarity + avg_depth + avg_relevance) / 3 * 20) if (avg_clarity + avg_depth + avg_relevance) > 0 else 50
    if capture_incomplete:
        overall_score = 0
    
    # Build score breakdown
    scores = ScoreBreakdown(
        communication=0 if capture_incomplete else int(avg_clarity * 20),
        clarity=0 if capture_incomplete else int(avg_clarity * 20),
        structure=0 if capture_incomplete else _calculate_structure_score(evaluations),
        technical_depth=(0 if capture_incomplete else int(avg_depth * 20)) if interview_type in ["technical", "mixed"] else None,
        relevance=0 if capture_incomplete else int(avg_relevance * 20)
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
    if evaluations:
        metrics['turn_evaluations'] = evaluations
        metrics['turn_eval_summary'] = {
            'turn_count': len(evaluations),
            'avg_clarity': round(avg_clarity, 2),
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
            ai_feedback = _build_deterministic_feedback(scores_for_ai)

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


def _build_deterministic_feedback(scores: Dict[str, int]) -> Dict[str, Any]:
    """Deterministic fallback so report generation never returns empty feedback."""
    overall = int(scores.get("overall_score", 50) or 50)
    if overall >= 80:
        summary = "Strong performance with clear communication and relevant examples."
        strengths = [
            "Clear communication under interview pressure",
            "Good structure in responses",
            "Relevant examples matched to questions",
        ]
    elif overall >= 60:
        summary = "Solid interview with good fundamentals and clear room to improve depth."
        strengths = [
            "Consistent participation and engagement",
            "Basic structure in most responses",
            "Reasonable alignment with interview prompts",
        ]
    else:
        summary = "Interview fundamentals are present, but response clarity and depth need improvement."
        strengths = [
            "Willingness to answer and engage",
            "Baseline understanding of interview flow",
        ]

    return {
        "overall_summary": summary,
        "strengths": strengths,
        "areas_for_improvement": [
            "Use STAR format for behavioral answers",
            "Add concrete examples with measurable outcomes",
            "State assumptions and tradeoffs more explicitly",
        ],
        "communication_feedback": "Keep answers concise, structured, and specific. Avoid filler and aim for clear start-middle-end delivery.",
        "content_feedback": "Increase depth with concrete project details, constraints, decisions, and impact metrics.",
        "tips_for_next_interview": [
            "Prepare 4-5 STAR stories across leadership, conflict, failure, and delivery",
            "Practice technical explanations with architecture tradeoffs",
            "Use a brief structure before each answer: context, action, outcome",
            "Close answers with what you learned and how you improved",
        ],
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
        # Fallback: use clarity as proxy for structure
        clarity_scores = [e.get("clarity_score", 3) * 20 for e in evaluations]
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
    clarity_scores = [e.get("clarity_score", 3) for e in evaluations]
    depth_scores = [e.get("depth_score", 3) for e in evaluations]
    relevance_scores = [e.get("relevance_score", 3) for e in evaluations]
    
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
