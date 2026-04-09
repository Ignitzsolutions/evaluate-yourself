"""Rubric MCP adapter for interview orchestration."""

from typing import Any, Dict, List, Optional


def get_rubric(
    interview_type: str,
    role_family: Optional[str],
    difficulty: str,
    selected_skills: Optional[List[str]] = None,
) -> Dict[str, Any]:
    normalized_type = str(interview_type or "mixed").strip().lower()
    normalized_difficulty = str(difficulty or "mid").strip().lower()
    skills = [str(skill).strip() for skill in (selected_skills or []) if str(skill).strip()]

    competencies = ["clarity", "relevance", "problem_solving"]
    if normalized_type in {"technical", "mixed"}:
        competencies.append("technical_depth")
    if normalized_type in {"behavioral", "mixed"}:
        competencies.append("communication")

    return {
        "tool": "rubric.get_rubric",
        "interview_type": normalized_type,
        "role_family": role_family or None,
        "difficulty": normalized_difficulty,
        "selected_skills": skills,
        "competencies": competencies,
        "grading_mode": "coach_grade_trusted",
    }
