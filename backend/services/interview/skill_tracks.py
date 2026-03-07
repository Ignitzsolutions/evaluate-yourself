"""Interview stream catalog and deterministic question matching helpers."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


TECHNICAL_TRACKS: List[Dict[str, Any]] = [
    {
        "id": "python_sql_github_cloud",
        "label": "Python Foundation (Python, SQL, GitHub, Cloud)",
        "description": "Beginner stream covering Python fundamentals, SQL basics, GitHub workflows, and cloud foundations.",
        "track_type": "technical",
        "domains": {"backend", "system_design"},
        "tags_any": {"basics", "db", "sql", "storage", "auth", "sessions", "api"},
        "opening_question": "Let's start with Python basics. Can you explain the difference between a list and a dictionary, and when you would use each?",
    },
    {
        "id": "java_full_stack",
        "label": "Java Full Stack",
        "description": "Beginner full-stack stream with Java backend foundations and web application flow understanding.",
        "track_type": "technical",
        "domains": {"backend", "system_design"},
        "tags_any": {"api", "auth", "sessions", "queue", "events", "basics"},
        "opening_question": "For a beginner Java full-stack path, can you walk me through how a request travels from browser to backend and back?",
    },
    {
        "id": "ml_python",
        "label": "Machine Learning with Python",
        "description": "Beginner ML stream focused on Python-based data prep, model basics, and evaluation fundamentals.",
        "track_type": "technical",
        "domains": {"backend", "system_design"},
        "tags_any": {"pipeline", "metrics", "data", "db", "sql", "basics"},
        "opening_question": "In beginner machine learning with Python, how would you split a dataset and measure whether your model is performing well?",
    },
    {
        "id": "genai_python_cloud",
        "label": "GenAI with Python (Azure/AWS)",
        "description": "Beginner GenAI stream with Python and practical cloud deployment basics on Azure or AWS.",
        "track_type": "technical",
        "domains": {"backend", "system_design"},
        "tags_any": {"api", "security", "multi-tenant", "rate-limiting", "reliability", "pipeline"},
        "opening_question": "For a beginner GenAI app in Python on Azure or AWS, what components would you include to make it secure and reliable?",
    },
    {
        "id": "frontend_react_node",
        "label": "Frontend Engineer (React + Node.js)",
        "description": "Beginner frontend stream with React fundamentals and Node.js API integration basics.",
        "track_type": "technical",
        "domains": {"backend", "system_design"},
        "tags_any": {"api", "auth", "sessions", "cache", "security", "basics"},
        "opening_question": "In a React + Node beginner project, how would you manage API calls and authenticated user sessions?",
    },
    {
        "id": "data_analytics_sql",
        "label": "Data Analytics (SQL + Python)",
        "description": "Beginner analytics stream focused on SQL querying, data validation, and insight communication.",
        "track_type": "technical",
        "domains": {"backend", "system_design"},
        "tags_any": {"db", "sql", "metrics", "pipeline", "storage", "ranking"},
        "opening_question": "In a beginner data analytics workflow, how would you use SQL and Python together to produce a reliable report?",
    },
    {
        "id": "cloud_devops_foundation",
        "label": "Cloud & DevOps Foundation",
        "description": "Beginner cloud/devops stream for deployment basics, monitoring, and reliability practices.",
        "track_type": "technical",
        "domains": {"backend", "system_design"},
        "tags_any": {"reliability", "scaling", "rollout", "multi-tenant", "queue", "events"},
        "opening_question": "For a beginner cloud/devops setup, what steps would you take to deploy safely and monitor service health?",
    },
]


BEHAVIORAL_TRACKS: List[Dict[str, Any]] = [
    {
        "id": "communication",
        "label": "Communication",
        "description": "Clarity, stakeholder communication, and explanation quality.",
        "track_type": "behavioral",
        "domains": {"behavioral"},
        "tags_any": {"communication", "intro", "learning", "growth"},
    },
    {
        "id": "teamwork_conflict",
        "label": "Teamwork & Conflict",
        "description": "Collaboration, conflict handling, and cross-team dynamics.",
        "track_type": "behavioral",
        "domains": {"behavioral"},
        "tags_any": {"teamwork", "conflict", "cross-team", "stakeholders"},
    },
    {
        "id": "ownership_execution",
        "label": "Ownership & Execution",
        "description": "Delivery ownership, accountability, process, and outcome execution.",
        "track_type": "behavioral",
        "domains": {"behavioral"},
        "tags_any": {"ownership", "process", "impact", "constraints", "risk"},
    },
    {
        "id": "leadership_influence",
        "label": "Leadership & Influence",
        "description": "Leading without authority, mentoring, and influencing outcomes.",
        "track_type": "behavioral",
        "domains": {"behavioral"},
        "tags_any": {"leadership", "influence", "mentoring", "hiring"},
    },
    {
        "id": "decision_tradeoffs",
        "label": "Decision Making & Tradeoffs",
        "description": "Ambiguity handling, judgment, tradeoffs, and prioritization decisions.",
        "track_type": "behavioral",
        "domains": {"behavioral"},
        "tags_any": {"tradeoffs", "decision-making", "prioritization", "ambiguity"},
    },
]


TRACKS_BY_ID: Dict[str, Dict[str, Any]] = {
    track["id"]: track for track in (TECHNICAL_TRACKS + BEHAVIORAL_TRACKS)
}

LEGACY_TRACK_ALIASES = {
    "backend_engineering": "python_sql_github_cloud",
    "system_design": "java_full_stack",
    "databases_storage": "data_analytics_sql",
    "scalability_reliability": "cloud_devops_foundation",
    "api_security_integration": "genai_python_cloud",
}


PROFILE_TO_TRACK_MAP = {
    "backend": "python_sql_github_cloud",
    "frontend": "frontend_react_node",
    "data": "data_analytics_sql",
    "cloud": "cloud_devops_foundation",
    "product": "java_full_stack",
    "sde": "python_sql_github_cloud",
    "analyst": "data_analytics_sql",
    "consultant": "java_full_stack",
    "management": "java_full_stack",
    "python": "python_sql_github_cloud",
    "java": "java_full_stack",
    "ml": "ml_python",
    "machine learning": "ml_python",
    "gen ai": "genai_python_cloud",
    "genai": "genai_python_cloud",
}


def _dedupe_keep_order(values: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for raw in values:
        value = str(raw or "").strip().lower()
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def technical_track_ids() -> List[str]:
    return [track["id"] for track in TECHNICAL_TRACKS]


def behavioral_track_ids() -> List[str]:
    return [track["id"] for track in BEHAVIORAL_TRACKS]


def is_technical_track(track_id: str) -> bool:
    track = TRACKS_BY_ID.get(str(track_id or "").strip().lower())
    return bool(track and track.get("track_type") == "technical")


def is_behavioral_track(track_id: str) -> bool:
    track = TRACKS_BY_ID.get(str(track_id or "").strip().lower())
    return bool(track and track.get("track_type") == "behavioral")


def normalize_track_ids(track_ids: Optional[List[str]]) -> List[str]:
    if not track_ids:
        return []
    resolved: List[str] = []
    for track_id in list(track_ids):
        raw = str(track_id or "").strip().lower()
        if not raw:
            continue
        resolved.append(LEGACY_TRACK_ALIASES.get(raw, raw))
    return _dedupe_keep_order(resolved)


def skill_selection_rules(interview_type: str) -> Dict[str, Any]:
    interview = str(interview_type or "technical").strip().lower()
    if interview == "technical":
        return {
            "min": 1,
            "max": 1,
            "allowed_track_type": "technical",
            "mixed_rule": None,
        }
    if interview == "mixed":
        return {
            "min": 1,
            "max": 1,
            "allowed_track_type": "technical",
            "mixed_rule": "1 technical skill is selected; behavioral stream is auto-applied by server.",
        }
    return {
        "min": 0,
        "max": len(BEHAVIORAL_TRACKS),
        "allowed_track_type": "behavioral",
        "mixed_rule": None,
    }


def catalog_for_interview_type(interview_type: str) -> List[Dict[str, str]]:
    interview = str(interview_type or "technical").strip().lower()
    if interview in {"technical", "mixed"}:
        source = TECHNICAL_TRACKS
    else:
        source = BEHAVIORAL_TRACKS
    return [
        {
            "id": track["id"],
            "label": track["label"],
            "description": track["description"],
            "track_type": track["track_type"],
        }
        for track in source
    ]


def validate_selected_skills(interview_type: str, selected_skills: Optional[List[str]]) -> Tuple[List[str], Optional[str]]:
    selected = normalize_track_ids(selected_skills)
    rules = skill_selection_rules(interview_type)
    allowed_type = rules["allowed_track_type"]

    if len(selected) < rules["min"] or len(selected) > rules["max"]:
        return [], (
            f"Invalid selectedSkills count for {interview_type}. "
            f"Expected between {rules['min']} and {rules['max']} selections."
        )

    for track_id in selected:
        track = TRACKS_BY_ID.get(track_id)
        if not track:
            return [], f"Unknown skill track: {track_id}"
        if track.get("track_type") != allowed_type:
            return [], f"Skill track {track_id} is not valid for {interview_type} interviews."

    return selected, None


def derive_profile_default_tracks(
    interview_type: str,
    *,
    target_roles: Optional[List[str]] = None,
    domain_expertise: Optional[List[str]] = None,
) -> List[str]:
    interview = str(interview_type or "technical").strip().lower()
    candidates: List[str] = []

    for source in (domain_expertise or []):
        mapped = PROFILE_TO_TRACK_MAP.get(str(source).strip().lower())
        if mapped:
            candidates.append(mapped)
    for source in (target_roles or []):
        mapped = PROFILE_TO_TRACK_MAP.get(str(source).strip().lower())
        if mapped:
            candidates.append(mapped)

    selected = _dedupe_keep_order(candidates)
    if interview == "technical":
        return selected[:1]
    if interview == "mixed":
        return selected[:1]
    return []


def track_label(track_id: str) -> str:
    track = TRACKS_BY_ID.get(str(track_id or "").strip().lower())
    return track.get("label", str(track_id)) if track else str(track_id)


def track_opening_question(track_id: str) -> Optional[str]:
    track = TRACKS_BY_ID.get(str(track_id or "").strip().lower())
    if not track:
        return None
    opening = track.get("opening_question")
    if not opening:
        return None
    return str(opening).strip() or None


def question_matches_track(question: Dict[str, Any], track_id: str) -> bool:
    explicit_track_id = str(question.get("_admin_track_id") or "").strip().lower()
    if explicit_track_id:
        return explicit_track_id == str(track_id or "").strip().lower()

    track = TRACKS_BY_ID.get(str(track_id or "").strip().lower())
    if not track:
        return False

    domain = str(question.get("domain") or "").strip().lower()
    tags = {str(tag).strip().lower() for tag in (question.get("topic_tags") or [])}
    allowed_domains = set(track.get("domains") or set())
    tags_any = set(track.get("tags_any") or set())

    if allowed_domains and domain in allowed_domains:
        return True
    if tags_any and tags.intersection(tags_any):
        return True
    return False


def filter_questions_for_track_ids(questions: List[Dict[str, Any]], track_ids: List[str]) -> List[Dict[str, Any]]:
    if not track_ids:
        return list(questions)
    selected = normalize_track_ids(track_ids)
    if not selected:
        return list(questions)
    filtered = [
        question
        for question in questions
        if any(question_matches_track(question, track_id) for track_id in selected)
    ]
    return filtered
