"""Centralised feature-flag helpers for admin observability + auth rollout.

Read once from env; default to safe values. Used by API/UI to enable
new surfaces incrementally without redeploying code.
"""

from __future__ import annotations

import os


def _truthy(value: str | None) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on", "enabled"}


def admin_live_ops_enabled() -> bool:
    """Master switch for /api/admin/live/* + /api/admin/tokens/*."""
    return _truthy(os.getenv("ADMIN_LIVE_OPS_ENABLED", "true"))


def auth_mfa_enabled() -> bool:
    """Master switch for TOTP MFA endpoints + admin enforcement."""
    return _truthy(os.getenv("AUTH_MFA_ENABLED", "true"))


def auth_lockout_enabled() -> bool:
    return _truthy(os.getenv("AUTH_LOCKOUT_ENABLED", "true"))


def usage_recording_enabled() -> bool:
    return _truthy(os.getenv("USAGE_RECORDING_ENABLED", "true"))


def demo_mode_enabled() -> bool:
    """When true and no API key is set, the app serves canned demo responses.

    This lets the entire app run end-to-end without any external credentials
    so it stays demoable in CI, contractor laptops, and review environments.
    """
    return _truthy(os.getenv("DEMO_MODE", "true"))


def communication_practice_enabled() -> bool:
    """Master switch for /api/communication-practice/*."""
    return _truthy(os.getenv("COMMUNICATION_PRACTICE_ENABLED", "true"))


def openai_configured() -> bool:
    """True when a usable OpenAI API key is present (placeholders don't count)."""
    key = (os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_REALTIME_API_KEY") or "").strip()
    if not key:
        return False
    bad = {"your-openai-api-key", "your-openai-api-key-here", "sk-dev-placeholder-no-real-calls"}
    if key in bad:
        return False
    if key.startswith("sk-dev-") or key.startswith("placeholder"):
        return False
    return True


def realtime_enabled() -> bool:
    """Realtime voice is only usable when a real API key is configured."""
    return openai_configured()
