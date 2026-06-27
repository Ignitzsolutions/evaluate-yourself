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
