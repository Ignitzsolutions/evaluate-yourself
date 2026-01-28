"""
CandidateFeedbackChain: Generate AI-powered candidate feedback from interview transcript.
Uses OpenAI/Azure OpenAI for analysis.
"""

import os
import json
import re
from typing import Dict, Any, List, Optional

CANDIDATE_FEEDBACK_PROMPT = """You are an expert interview coach and HR professional. Analyze the following interview transcript and provide detailed, constructive feedback for the candidate.

Interview Type: {interview_type}
Duration: {duration} minutes

TRANSCRIPT:
{transcript}

PERFORMANCE SCORES (out of 100):
- Communication: {communication_score}
- Clarity: {clarity_score}
- Structure: {structure_score}
- Relevance: {relevance_score}
- Overall Score: {overall_score}

Based on this interview, provide feedback in the following JSON format:
{{
    "overall_summary": "A 2-3 sentence summary of the candidate's overall performance",
    "strengths": ["List 3-4 specific strengths demonstrated in the interview"],
    "areas_for_improvement": ["List 3-4 specific areas that need improvement"],
    "communication_feedback": "Detailed feedback on communication style, tone, and clarity",
    "content_feedback": "Feedback on the substance and quality of answers",
    "tips_for_next_interview": ["3-4 actionable tips for the candidate's next interview"]
}}

Be specific, constructive, and encouraging. Reference actual examples from the transcript when possible.
Output ONLY the JSON object, no additional text."""


def _build_transcript_string(transcript: List[Dict[str, Any]]) -> str:
    """Format transcript for the prompt."""
    lines = []
    for t in transcript:
        speaker = t.get("speaker", "Unknown").strip()
        label = "INTERVIEWER" if speaker.lower() in ["interviewer", "sonia", "ai"] else "CANDIDATE"
        text = (t.get("text") or "").strip()
        if text:
            lines.append(f"{label}: {text}")
    return "\n\n".join(lines) if lines else "No transcript content available."


def _get_openai_client():
    """Return (Azure OpenAI or OpenAI client, model_or_deployment_name) from env."""
    try:
        from openai import OpenAI, AzureOpenAI
    except ImportError:
        return None, None

    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")

    if azure_key and azure_endpoint and (azure_key != "your-azure-openai-api-key-here"):
        deployment = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT") or os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
        client = AzureOpenAI(
            api_key=azure_key,
            azure_endpoint=azure_endpoint.rstrip("/"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
        )
        return client, deployment
    if api_key and api_key != "your-openai-api-key-here":
        return OpenAI(api_key=api_key), os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
    return None, None


def generate_candidate_feedback(
    transcript: List[Dict[str, Any]],
    scores: Dict[str, int],
    interview_type: str = "behavioral",
    duration_minutes: int = 0
) -> Optional[Dict[str, Any]]:
    """
    Generate AI-powered feedback for the interview candidate.
    
    Args:
        transcript: List of transcript messages with speaker and text
        scores: Dict with communication, clarity, structure, relevance, overall_score
        interview_type: Type of interview (behavioral, technical, mixed)
        duration_minutes: Interview duration
    
    Returns:
        Dict with overall_summary, strengths, areas_for_improvement, 
        communication_feedback, content_feedback, tips_for_next_interview
        Returns None on failure.
    """
    transcript_str = _build_transcript_string(transcript)
    
    # Build the prompt
    prompt = CANDIDATE_FEEDBACK_PROMPT.format(
        interview_type=interview_type.capitalize(),
        duration=duration_minutes,
        transcript=transcript_str,
        communication_score=scores.get("communication", 50),
        clarity_score=scores.get("clarity", 50),
        structure_score=scores.get("structure", 50),
        relevance_score=scores.get("relevance", 50),
        overall_score=scores.get("overall_score", 50)
    )

    client, model_or_deploy = _get_openai_client()
    if not client:
        print("⚠️ No OpenAI client available for candidate feedback generation")
        return _generate_fallback_feedback(scores)

    try:
        print(f"🤖 Generating AI candidate feedback using {model_or_deploy}...")
        resp = client.chat.completions.create(
            model=model_or_deploy or "gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=1200,
        )
        raw = (resp.choices or [{}])[0].message.content or ""
    except Exception as e:
        print(f"❌ CandidateFeedbackChain error: {e}")
        return _generate_fallback_feedback(scores)

    # Parse JSON from response (allow wrapped in markdown code block)
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if m:
        raw = m.group(1).strip()
    
    try:
        feedback = json.loads(raw)
        print("✅ AI candidate feedback generated successfully")
        return feedback
    except json.JSONDecodeError as e:
        print(f"⚠️ Failed to parse AI feedback JSON: {e}")
        return _generate_fallback_feedback(scores)


def _generate_fallback_feedback(scores: Dict[str, int]) -> Dict[str, Any]:
    """Generate basic fallback feedback when AI is unavailable."""
    overall = scores.get("overall_score", 50)
    
    if overall >= 80:
        summary = "Strong interview performance with clear communication and relevant answers."
        strengths = ["Clear and articulate communication", "Well-structured responses", "Good engagement with the interviewer"]
    elif overall >= 60:
        summary = "Solid interview performance with room for improvement in some areas."
        strengths = ["Adequate communication skills", "Reasonable structure in answers", "Basic engagement with questions"]
    else:
        summary = "Interview performance needs improvement. Focus on structure and clarity in your responses."
        strengths = ["Willingness to participate", "Attempt to answer questions directly"]
    
    return {
        "overall_summary": summary,
        "strengths": strengths,
        "areas_for_improvement": [
            "Practice structuring answers using the STAR method (Situation, Task, Action, Result)",
            "Provide more specific examples from past experience",
            "Work on maintaining consistent engagement throughout the interview"
        ],
        "communication_feedback": "Focus on speaking clearly and at a measured pace. Take a moment to organize your thoughts before responding to ensure your answers are coherent and well-structured.",
        "content_feedback": "Ensure your answers directly address the question asked. Use specific examples from your experience to illustrate your points and demonstrate your capabilities.",
        "tips_for_next_interview": [
            "Research the company and role thoroughly before the interview",
            "Prepare 3-5 stories that demonstrate key competencies using the STAR method",
            "Practice answering common interview questions out loud",
            "Prepare thoughtful questions to ask about the role and team"
        ]
    }
