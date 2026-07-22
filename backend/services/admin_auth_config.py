from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional


def _truthy(value: Optional[str]) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _environment(env: Mapping[str, str]) -> str:
    return str(
        env.get("ENV")
        or env.get("APP_ENV")
        or env.get("ENVIRONMENT")
        or env.get("PYTHON_ENV")
        or env.get("NODE_ENV")
        or "development"
    ).strip().lower()


def _allowlist(raw: Optional[str]) -> set[str]:
    return {item.strip() for item in str(raw or "").split(",") if item.strip()}


@dataclass(frozen=True)
class AdminAuthConfig:
    environment: str
    is_production: bool
    admin_clerk_user_ids: set[str]
    admin_allow_all_local: bool
    dev_auth_bypass: bool


def resolve_admin_auth_config(env: Mapping[str, str]) -> AdminAuthConfig:
    environment = _environment(env)
    is_production = environment == "production"
    admin_ids = _allowlist(env.get("ADMIN_CLERK_USER_IDS"))
    allow_all_local = "*" in admin_ids and not is_production
    dev_bypass = _truthy(env.get("DEV_AUTH_BYPASS")) or allow_all_local
    if is_production:
        dev_bypass = False
        allow_all_local = False
    return AdminAuthConfig(
        environment=environment,
        is_production=is_production,
        admin_clerk_user_ids=admin_ids,
        admin_allow_all_local=allow_all_local,
        dev_auth_bypass=dev_bypass,
    )


def validate_admin_auth_config(config: AdminAuthConfig) -> None:
    if config.is_production and not config.admin_clerk_user_ids:
        raise RuntimeError("ADMIN_CLERK_USER_IDS must be set in production.")
    if config.is_production and config.dev_auth_bypass:
        raise RuntimeError("DEV_AUTH_BYPASS cannot be enabled in production.")


def build_admin_auth_summary(config: AdminAuthConfig) -> str:
    mode = "allow_all_local" if config.admin_allow_all_local else "allowlist"
    return (
        f"environment={config.environment} mode={mode} "
        f"allowlist_count={len(config.admin_clerk_user_ids)} "
        f"dev_auth_bypass={str(config.dev_auth_bypass).lower()}"
    )
