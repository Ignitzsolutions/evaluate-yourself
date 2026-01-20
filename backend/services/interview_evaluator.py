"""Evaluation engine for assessing interview responses."""

from typing import Dict, Any, Optional, List
import re


def evaluate_response(
    transcript: str,
    question_type: str,
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluate a user's response to an interview question.
    
    Args:
        transcript: The user's spoken response text
        question_type: Type of question (behavioral, technical, mixed)
        context: Optional context (previous answers, question text, etc.)
    
    Returns:
        Dictionary with evaluation scores and signals
    """
    if not transcript or len(transcript.strip()) < 10:
        return {
            "clarity_score": 1,
            "depth_score": 1,
            "relevance_score": 1,
            "confidence_signal": "low",
            "star_completeness": {"situation": False, "task": False, "action": False, "result": False},
            "technical_correctness": "low",
            "notes": ["Response too short or unclear"],
            "word_count": len(transcript.split()),
            "pause_count": transcript.count("...") + transcript.count("um") + transcript.count("uh")
        }
    
    words = transcript.split()
    word_count = len(words)
    
    # Clarity score (1-5)
    clarity_score = _evaluate_clarity(transcript, word_count)
    
    # Depth score (1-5)
    depth_score = _evaluate_depth(transcript, question_type, word_count)
    
    # Relevance score (1-5)
    relevance_score = _evaluate_relevance(transcript, context)
    
    # Confidence signals
    confidence_signal = _evaluate_confidence(transcript)
    
    # STAR completeness (for behavioral questions)
    star_completeness = _evaluate_star(transcript) if question_type in ["behavioral", "mixed"] else None
    
    # Technical correctness (for technical questions)
    technical_correctness = _evaluate_technical(transcript) if question_type in ["technical", "mixed"] else None
    
    # Generate notes
    notes = _generate_notes(transcript, clarity_score, depth_score, relevance_score, star_completeness)
    
    # Count pauses/fillers
    pause_count = len(re.findall(r'\b(um|uh|er|ah|like|you know)\b', transcript.lower()))
    
    result = {
        "clarity_score": clarity_score,
        "depth_score": depth_score,
        "relevance_score": relevance_score,
        "confidence_signal": confidence_signal,
        "notes": notes,
        "word_count": word_count,
        "pause_count": pause_count
    }
    
    if star_completeness:
        result["star_completeness"] = star_completeness
    
    if technical_correctness:
        result["technical_correctness"] = technical_correctness
    
    return result


def _evaluate_clarity(transcript: str, word_count: int) -> int:
    """Evaluate clarity of response (1-5)."""
    score = 3  # Base score
    
    # Positive indicators
    if word_count > 50:  # Sufficient length
        score += 1
    if not re.search(r'\b(um|uh|er|ah)\b', transcript.lower()):  # No fillers
        score += 0.5
    if len(transcript) > 200:  # Detailed response
        score += 0.5
    
    # Negative indicators
    if word_count < 20:  # Too short
        score -= 1
    if transcript.count("...") > 3:  # Too many pauses
        score -= 0.5
    if re.search(r'\b(um|uh|er|ah)\b', transcript.lower(), flags=re.IGNORECASE):  # Fillers present
        score -= 0.5
    
    return max(1, min(5, int(score)))


def _evaluate_depth(transcript: str, question_type: str, word_count: int) -> int:
    """Evaluate depth of response (1-5)."""
    score = 2  # Base score
    
    # Length indicates depth
    if word_count > 100:
        score += 1
    if word_count > 200:
        score += 1
    
    # Specificity indicators
    if re.search(r'\d+', transcript):  # Contains numbers (specific metrics)
        score += 0.5
    if re.search(r'\b(because|since|due to|as a result)\b', transcript.lower()):  # Explanations
        score += 0.5
    if re.search(r'\b(implemented|created|developed|built|designed)\b', transcript.lower()):  # Action verbs
        score += 0.5
    
    # For technical questions, look for technical terms
    if question_type in ["technical", "mixed"]:
        tech_terms = ["algorithm", "data structure", "API", "database", "framework", "library", "optimization", "scalability"]
        if any(term in transcript.lower() for term in tech_terms):
            score += 0.5
    
    return max(1, min(5, int(score)))


def _evaluate_relevance(transcript: str, context: Optional[Dict[str, Any]] = None) -> int:
    """Evaluate relevance to the question (1-5)."""
    score = 3  # Base score (assume relevant unless proven otherwise)
    
    # If transcript is very short, likely not relevant
    if len(transcript.split()) < 15:
        score -= 1
    
    # Look for question-answering indicators
    if re.search(r'\b(I|we|my|our|the|a|an)\b', transcript, flags=re.IGNORECASE):
        score += 0.5  # Personal/contextual response
    
    # Very generic responses might be less relevant
    generic_phrases = ["it depends", "that's a good question", "let me think"]
    if any(phrase in transcript.lower() for phrase in generic_phrases) and len(transcript.split()) < 30:
        score -= 0.5
    
    return max(1, min(5, int(score)))


def _evaluate_confidence(transcript: str) -> str:
    """Evaluate confidence level from transcript."""
    low_confidence_indicators = [
        "i think", "maybe", "i guess", "i'm not sure", "probably", "perhaps",
        "kind of", "sort of", "a little bit"
    ]
    high_confidence_indicators = [
        "definitely", "certainly", "absolutely", "clearly", "obviously",
        "i know", "i'm confident", "without a doubt"
    ]
    
    transcript_lower = transcript.lower()
    
    low_count = sum(1 for phrase in low_confidence_indicators if phrase in transcript_lower)
    high_count = sum(1 for phrase in high_confidence_indicators if phrase in transcript_lower)
    
    if high_count > low_count and high_count > 0:
        return "high"
    elif low_count > 2:
        return "low"
    else:
        return "med"


def _evaluate_star(transcript: str) -> Dict[str, bool]:
    """Evaluate STAR method completeness for behavioral questions."""
    transcript_lower = transcript.lower()
    
    # Situation indicators
    situation_keywords = ["situation", "context", "when", "at", "working", "project", "team", "company"]
    situation = any(kw in transcript_lower for kw in situation_keywords) and len(transcript.split()) > 20
    
    # Task indicators
    task_keywords = ["task", "goal", "objective", "needed to", "had to", "challenge", "problem"]
    task = any(kw in transcript_lower for kw in task_keywords)
    
    # Action indicators
    action_keywords = ["i did", "i implemented", "i created", "i developed", "i worked", "i collaborated", "we decided"]
    action = any(kw in transcript_lower for kw in action_keywords)
    
    # Result indicators
    result_keywords = ["result", "outcome", "impact", "improved", "increased", "reduced", "saved", "achieved", "success"]
    result = any(kw in transcript_lower for kw in result_keywords)
    
    return {
        "situation": situation,
        "task": task,
        "action": action,
        "result": result
    }


def _evaluate_technical(transcript: str) -> str:
    """Evaluate technical correctness (for technical questions)."""
    # This is a simplified heuristic - in production, might use LLM or knowledge base
    technical_terms = [
        "algorithm", "complexity", "O(", "data structure", "API", "database",
        "framework", "library", "optimization", "scalability", "architecture",
        "design pattern", "best practice", "implementation"
    ]
    
    transcript_lower = transcript.lower()
    tech_term_count = sum(1 for term in technical_terms if term in transcript_lower)
    
    if tech_term_count >= 3:
        return "high"
    elif tech_term_count >= 1:
        return "med"
    else:
        return "low"


def _generate_notes(
    transcript: str,
    clarity: int,
    depth: int,
    relevance: int,
    star_completeness: Optional[Dict[str, bool]] = None
) -> List[str]:
    """Generate evaluation notes."""
    notes = []
    
    if clarity < 3:
        notes.append("Response could be clearer - consider reducing fillers and pauses")
    if depth < 3:
        notes.append("Answer lacks depth - add more specific details and examples")
    if relevance < 3:
        notes.append("Response may be off-topic - ensure answer directly addresses the question")
    
    if star_completeness:
        missing = [k for k, v in star_completeness.items() if not v]
        if missing:
            notes.append(f"STAR method incomplete - missing: {', '.join(missing)}")
    
    if len(transcript.split()) < 30:
        notes.append("Response is quite brief - consider expanding with more context")
    
    return notes if notes else ["Response shows good structure and clarity"]
