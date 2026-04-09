"""
CandidateFeedbackChain: Generate AI-powered candidate feedback from interview transcript.
Uses OpenAI/Azure OpenAI for analysis with LangChain structured output support.
"""

import os
import json
import re
from typing import Dict, Any, List, Optional

try:
    from services.llm.provider_adapter import create_chat_completion
except Exception:  # pragma: no cover
    from backend.services.llm.provider_adapter import create_chat_completion  # type: ignore

try:
    from langchain_openai import ChatOpenAI, AzureChatOpenAI
    from langchain_core.messages import HumanMessage
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    print("⚠️ LangChain not available - falling back to direct OpenAI API calls")

try:
    from ..schemas.feedback_output import CandidateFeedback
    SCHEMAS_AVAILABLE = True
except ImportError:
    SCHEMAS_AVAILABLE = False
    print("⚠️ Feedback schemas not available - using unstructured output")

_missing_chat_deployment_warned = False

CANDIDATE_FEEDBACK_PROMPT = """You are an expert interview coach. Analyze the interview transcript and provide evidence-based feedback.

Interview Type: {interview_type}
Duration: {duration} minutes

PERFORMANCE SCORES (out of 100):
- Communication: {communication_score}
- Clarity: {clarity_score}
- Structure: {structure_score}
- Relevance: {relevance_score}
- Overall: {overall_score}

TRANSCRIPT:
{transcript}

Rules for feedback:
- Every strength MUST cite a direct quote from the transcript that demonstrates it
- Every area for improvement MUST cite what the candidate said that revealed the gap
- Be specific and evidence-based — no generic advice

Return ONLY this JSON:
{{
    "overall_summary": "2-3 sentences summarizing performance, citing one specific example",
    "strengths": [
        {{"strength": "What they did well", "evidence_quote": "exact quote or paraphrase from their answer", "why": "why this demonstrates the strength"}},
        {{"strength": "...", "evidence_quote": "...", "why": "..."}}
    ],
    "areas_for_improvement": [
        {{"area": "What needs work", "transcript_quote": "what they said that showed the gap", "better_approach": "how they should have answered"}},
        {{"area": "...", "transcript_quote": "...", "better_approach": "..."}}
    ],
    "communication_feedback": "Specific feedback on delivery, citing examples of filler words, hedging, or strong moments",
    "content_feedback": "Feedback on substance and depth, citing specific answer content",
    "tips_for_next_interview": ["Actionable tip 1 based on this transcript", "Actionable tip 2", "Actionable tip 3"]
}}

Output ONLY the JSON object."""


STRUCTURED_FEEDBACK_PROMPT = """You are an expert interview coach and HR professional. Analyze the following interview transcript and provide detailed, constructive feedback for the candidate.

Interview Type: {interview_type}
Duration: {duration} minutes

TRANSCRIPT:
{transcript}

Provide comprehensive feedback evaluating the candidate across these categories:
- communication: Speaking clarity, tone, pace, articulation
- technical_knowledge: Domain expertise, accuracy, depth of knowledge
- problem_solving: Analytical thinking, creativity, systematic approach
- cultural_fit: Teamwork, adaptability, alignment with company values

For each category, provide:
1. A score from 0-10
2. Specific evidence from the interview
3. Detailed constructive feedback (50-800 characters)

Also provide:
- An overall_summary (2-3 sentences, 100-600 characters)
- 3-6 specific strengths demonstrated
- 3-6 areas for improvement
- A hiring recommendation: "strong_hire", "hire", "maybe", or "no_hire"

Be specific, constructive, and encouraging. Reference actual examples from the transcript."""


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


def _get_langchain_client():
    """Return LangChain ChatOpenAI or AzureChatOpenAI client from env."""
    if not LANGCHAIN_AVAILABLE:
        return None
    
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    
    if azure_key and azure_endpoint and (azure_key != "your-azure-openai-api-key-here"):
        global _missing_chat_deployment_warned
        deployment = (os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "") or "").strip()
        if not deployment:
            if not _missing_chat_deployment_warned:
                print("⚠️ AZURE_OPENAI_CHAT_DEPLOYMENT is not set; skipping LangChain Azure chat client.")
                _missing_chat_deployment_warned = True
            return None
        try:
            return AzureChatOpenAI(
                api_key=azure_key,
                azure_endpoint=azure_endpoint.rstrip("/"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview"),
                deployment_name=deployment,
                temperature=0.4,
                max_tokens=2000,
            )
        except Exception as e:
            print(f"⚠️ Failed to initialize AzureChatOpenAI: {e}")
            return None
    
    if api_key and api_key != "your-openai-api-key-here":
        try:
            return ChatOpenAI(
                api_key=api_key,
                model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
                temperature=0.4,
                max_tokens=2000,
            )
        except Exception as e:
            print(f"⚠️ Failed to initialize ChatOpenAI: {e}")
            return None
    
    return None


def generate_candidate_feedback(
    transcript: Optional[List[Dict[str, Any]]] = None,
    scores: Optional[Dict[str, int]] = None,
    interview_type: str = "behavioral",
    duration_minutes: int = 0,
    # New parameters (PHASE 2)
    transcript_text: Optional[str] = None,
    llm_context: Optional[Any] = None,  # LLMContext
    score_summary: Optional[Dict[str, int]] = None,
    # New parameter for structured output
    use_structured_output: bool = True
) -> Optional[Dict[str, Any]]:
    """
    Generate AI-powered feedback for the interview candidate.
    
    Args:
        transcript: (Legacy) List of transcript messages with speaker and text
        scores: (Legacy) Dict with communication, clarity, structure, relevance, overall_score
        interview_type: Type of interview (behavioral, technical, mixed)
        duration_minutes: Interview duration
        transcript_text: (New) Direct transcript text string
        llm_context: (New) LLMContext object (session_id, role, locale)
        score_summary: (New) Score summary dict
        use_structured_output: If True, use LangChain with_structured_output (requires LangChain + schemas)
    
    Returns:
        Dict with overall_summary, strengths, areas_for_improvement, 
        communication_feedback, content_feedback, tips_for_next_interview
        Returns None on failure.
    """
    # Backward compatibility: handle both old and new parameter styles
    if transcript_text:
        transcript_str = transcript_text
    elif transcript:
        transcript_str = _build_transcript_string(transcript)
    else:
        transcript_str = "No transcript available"
    
    # Use new score_summary if provided, else fall back to legacy scores
    active_scores = score_summary if score_summary else (scores if scores else {})
    
    # Try structured output first if enabled and available
    if use_structured_output and LANGCHAIN_AVAILABLE and SCHEMAS_AVAILABLE:
        result = _generate_structured_feedback(
            transcript_str=transcript_str,
            interview_type=interview_type,
            duration_minutes=duration_minutes
        )
        if result:
            return result
        # Fall through to legacy on failure
        print("⚠️ Structured output failed, falling back to legacy method")
    
    # Legacy method (direct OpenAI API calls)
    return _generate_legacy_feedback(
        transcript_str=transcript_str,
        interview_type=interview_type,
        duration_minutes=duration_minutes,
        active_scores=active_scores
    )


def _generate_structured_feedback(
    transcript_str: str,
    interview_type: str,
    duration_minutes: int
) -> Optional[Dict[str, Any]]:
    """Generate feedback using LangChain with structured output."""
    llm = _get_langchain_client()
    if not llm:
        return None
    
    try:
        # Create structured output chain
        print("🤖 Generating AI candidate feedback using LangChain structured output...")
        structured_llm = llm.with_structured_output(CandidateFeedback)
        
        # Build prompt
        prompt_text = STRUCTURED_FEEDBACK_PROMPT.format(
            interview_type=interview_type.capitalize(),
            duration=duration_minutes,
            transcript=transcript_str
        )
        
        # Invoke chain
        result: CandidateFeedback = structured_llm.invoke([HumanMessage(content=prompt_text)])
        
        # Convert to legacy format for backward compatibility
        feedback = result.to_legacy_format()
        
        # Also attach the full structured format for new consumers
        feedback["_structured"] = result.model_dump()
        feedback["_report_format"] = result.to_report_format()
        
        print("✅ AI candidate feedback generated successfully (structured)")
        return feedback
        
    except Exception as e:
        msg = str(e)
        if "404" in msg or "Resource not found" in msg:
            print("⚠️ Structured feedback deployment not found; using deterministic fallback feedback.")
        else:
            print(f"❌ Structured feedback generation error: {e}")
        return None


def _generate_legacy_feedback(
    transcript_str: str,
    interview_type: str,
    duration_minutes: int,
    active_scores: Dict[str, int]
) -> Optional[Dict[str, Any]]:
    """Generate feedback using legacy direct OpenAI API calls."""
    # Build the prompt
    prompt = CANDIDATE_FEEDBACK_PROMPT.format(
        interview_type=interview_type.capitalize(),
        duration=duration_minutes,
        transcript=transcript_str,
        communication_score=active_scores.get("communication", 50),
        clarity_score=active_scores.get("clarity", 50),
        structure_score=active_scores.get("structure", 50),
        relevance_score=active_scores.get("relevance", 50),
        overall_score=active_scores.get("overall_score", 50)
    )

    if create_chat_completion is None:
        print("⚠️ No OpenAI client available for candidate feedback generation")
        return _generate_fallback_feedback(active_scores)

    try:
        print("🤖 Generating AI candidate feedback using provider adapter (legacy)...")
        resp = create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            purpose="candidate_feedback",
            temperature=0.4,
            max_tokens=1200,
        )
        raw = str(resp.get("text") or "")
    except TypeError as e:
        # Handle library version mismatches (e.g., unexpected keyword arguments)
        error_msg = str(e)
        if "unexpected keyword argument" in error_msg:
            print(f"⚠️ OpenAI library version mismatch or configuration error: {error_msg}")
            print("   Falling back to basic feedback generation")
        else:
            print(f"❌ CandidateFeedbackChain TypeError: {e}")
        return _generate_fallback_feedback(active_scores)
    except Exception as e:
        msg = str(e)
        if "404" in msg or "Resource not found" in msg:
            print("⚠️ Candidate feedback deployment not found; using deterministic fallback feedback.")
        else:
            print(f"❌ CandidateFeedbackChain error: {e}")
        return _generate_fallback_feedback(active_scores)

    # Parse JSON from response (allow wrapped in markdown code block)
    raw = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if m:
        raw = m.group(1).strip()
    
    try:
        feedback = json.loads(raw)
        feedback = _normalize_feedback_contract(feedback, active_scores, transcript_str)
        if isinstance(resp.get("provider_trace"), dict):
            feedback["_provider_trace"] = resp.get("provider_trace")
        print("✅ AI candidate feedback generated successfully (legacy)")
        return feedback
    except json.JSONDecodeError as e:
        print(f"⚠️ Failed to parse AI feedback JSON: {e}")
        return _generate_fallback_feedback(active_scores, transcript_str)


def _extract_candidate_evidence(transcript_str: str, limit: int = 3) -> List[str]:
    snippets: List[str] = []
    for line in (transcript_str or "").splitlines():
        line = line.strip()
        if not line or not line.startswith("CANDIDATE:"):
            continue
        text = line.replace("CANDIDATE:", "", 1).strip()
        if not text:
            continue
        snippets.append(text[:120])
        if len(snippets) >= limit:
            break
    return snippets


def _normalize_feedback_contract(feedback: Dict[str, Any], scores: Dict[str, int], transcript_str: str) -> Dict[str, Any]:
    """Normalize AI feedback to a stable structure that supports both legacy and evidence-based formats."""
    if not isinstance(feedback, dict):
        return _generate_fallback_feedback(scores, transcript_str)

    summary = str(feedback.get("overall_summary") or "").strip()
    if not summary:
        summary = _generate_fallback_feedback(scores, transcript_str).get("overall_summary", "")

    # Handle evidence-based strength format: [{strength, evidence_quote, why}] or [str]
    raw_strengths = feedback.get("strengths") or []
    strengths = []
    for item in raw_strengths:
        if isinstance(item, dict):
            text = str(item.get("strength") or "").strip()
            quote = str(item.get("evidence_quote") or "").strip()
            why = str(item.get("why") or "").strip()
            if text:
                if quote:
                    strengths.append(f'{text} — "{quote[:100]}"' if quote else text)
                else:
                    strengths.append(text)
        elif isinstance(item, str) and item.strip():
            strengths.append(item.strip())

    # Handle evidence-based improvement format: [{area, transcript_quote, better_approach}] or [str]
    raw_improvements = feedback.get("areas_for_improvement") or []
    improvements = []
    for item in raw_improvements:
        if isinstance(item, dict):
            area = str(item.get("area") or "").strip()
            quote = str(item.get("transcript_quote") or "").strip()
            better = str(item.get("better_approach") or "").strip()
            if area:
                text = area
                if quote:
                    text += f' (You said: "{quote[:80]}")'
                if better:
                    text += f" → {better[:100]}"
                improvements.append(text)
        elif isinstance(item, str) and item.strip():
            improvements.append(item.strip())

    tips = feedback.get("tips_for_next_interview")
    if not isinstance(tips, list):
        tips = []
    tips = [str(t).strip() for t in tips if str(t).strip()]

    base = _generate_fallback_feedback(scores, transcript_str)
    while len(strengths) < 2:
        strengths.append(base["strengths"][len(strengths) % len(base["strengths"])])
    while len(improvements) < 2:
        improvements.append(base["areas_for_improvement"][len(improvements) % len(base["areas_for_improvement"])])
    while len(tips) < 3:
        tips.append(base["tips_for_next_interview"][len(tips) % len(base["tips_for_next_interview"])])

    return {
        "overall_summary": summary,
        "strengths": strengths[:6],
        "areas_for_improvement": improvements[:6],
        "communication_feedback": str(feedback.get("communication_feedback") or base["communication_feedback"]),
        "content_feedback": str(feedback.get("content_feedback") or base["content_feedback"]),
        "tips_for_next_interview": tips[:6],
    }


def _generate_fallback_feedback(scores: Dict[str, int], transcript_str: str = "") -> Dict[str, Any]:
    """Generate basic fallback feedback when AI is unavailable."""
    overall = scores.get("overall_score", 50)
    evidence = _extract_candidate_evidence(transcript_str, limit=3)
    
    if overall >= 80:
        summary = "Strong interview performance with clear communication and relevant answers."
        strengths = ["Clear and articulate communication", "Well-structured responses", "Good engagement with the interviewer"]
    elif overall >= 60:
        summary = "Solid interview performance with room for improvement in some areas."
        strengths = ["Adequate communication skills", "Reasonable structure in answers", "Basic engagement with questions"]
    else:
        summary = "Interview performance needs improvement. Focus on structure and clarity in your responses."
        strengths = ["Willingness to participate", "Attempt to answer questions directly"]

    while len(strengths) < 3:
        strengths.append("Shows intent to improve with continued structured practice")

    if evidence:
        strengths[0] = f"{strengths[0]} (Evidence: \"{evidence[0]}\")"
    
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
