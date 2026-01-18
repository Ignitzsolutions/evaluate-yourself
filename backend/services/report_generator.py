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
        session_state: InterviewState instance with all session data
        interview_type: Type of interview (behavioral, technical, mixed)
        duration_minutes: Total interview duration in minutes
    
    Returns:
        InterviewReport model instance
    """
    evaluations = session_state.evaluation_results
    transcript_history = session_state.transcript_history
    performance_summary = session_state.get_performance_summary()
    
    # Calculate overall scores
    avg_clarity = performance_summary.get("avg_clarity", 0)
    avg_depth = performance_summary.get("avg_depth", 0)
    avg_relevance = performance_summary.get("avg_relevance", 0)
    
    # Calculate overall score (0-100)
    overall_score = int((avg_clarity + avg_depth + avg_relevance) / 3 * 20)
    
    # Build score breakdown
    scores = ScoreBreakdown(
        communication=int(avg_clarity * 20),
        clarity=int(avg_clarity * 20),
        structure=_calculate_structure_score(evaluations),
        technical_depth=int(avg_depth * 20) if interview_type in ["technical", "mixed"] else None,
        relevance=int(avg_relevance * 20)
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
        questions=session_state.question_index,
        is_sample=False
    )
    
    return report


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
