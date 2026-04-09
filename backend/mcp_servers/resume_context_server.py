"""Resume context MCP adapter for interview orchestration."""

from typing import Any, Dict, Optional


def get_candidate_context(candidate_profile: Optional[Any], role_target: Optional[str]) -> Dict[str, Any]:
    if not candidate_profile:
        return {
            "tool": "resume_context.get_candidate_context",
            "resume_available": False,
            "role_target": role_target or None,
        }

    return {
        "tool": "resume_context.get_candidate_context",
        "resume_available": bool(getattr(candidate_profile, "resume_url", None)),
        "role_target": role_target or None,
        "resume_url": getattr(candidate_profile, "resume_url", None),
        "linkedin_url": getattr(candidate_profile, "linkedin_url", None),
        "github_url": getattr(candidate_profile, "github_url", None),
        "primary_stream": getattr(candidate_profile, "primary_stream", None),
        "target_roles": list(getattr(candidate_profile, "target_roles_json", []) or []),
    }
