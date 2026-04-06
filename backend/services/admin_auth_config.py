from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional


TRUTHY_VALUES = {"1", "true", "yes", "on"}


def parse_admin_allowlist(raw: Optional[str]) -> set[str]:
    if not raw:
        return set()
    return {item.strip() for item in raw.split(",") if item.strip()}


@dataclass(frozen=True)
class AdminAuthConfig:
    environment: str
    is_production: bool
    admin_clerk_user_ids: set[str]
    admin_allow_all_local: bool
    dev_auth_bypass: bool


def resolve_admin_auth_config(env: Mapping[str, str]) -> AdminAuthConfig:
    environment = (
        env.get("ENV")
        or env.get("ENVIRONMENT")
        or env.get("PYTHON_ENV")
        or env.get("NODE_ENV")
        or ""
    ).strip().lower()
    is_production = environment == "production"

    admin_clerk_user_ids = parse_admin_allowlist(env.get("ADMIN_CLERK_USER_IDS", ""))
    admin_allow_all_local = ("*" in admin_clerk_user_ids) and (not is_production)
    dev_auth_bypass_raw = (env.get("DEV_AUTH_BYPASS", "true" if admin_allow_all_local else "false") or "").strip().lower()
    dev_auth_bypass = dev_auth_bypass_raw in TRUTHY_VALUES

    return AdminAuthConfig(
        environment=environment or "development",
        is_production=is_production,
        admin_clerk_user_ids=admin_clerk_user_ids,
        admin_allow_all_local=admin_allow_all_local,
        dev_auth_bypass=dev_auth_bypass,
    )


def validate_admin_auth_config(config: AdminAuthConfig) -> None:
    if not config.is_production:
        return
    if config.dev_auth_bypass:
        raise RuntimeError("DEV_AUTH_BYPASS must be disabled in production.")
    if not config.admin_clerk_user_ids:
        raise RuntimeError("ADMIN_CLERK_USER_IDS must be set in production.")
    if "*" in config.admin_clerk_user_ids:
        raise RuntimeError("ADMIN_CLERK_USER_IDS cannot contain '*' in production.")


def build_admin_auth_summary(config: AdminAuthConfig) -> str:
    mode = "production" if config.is_production else "development"
    if config.dev_auth_bypass:
        auth_mode = "dev-auth-bypass"
    elif config.admin_allow_all_local:
        auth_mode = "local-allow-all"
    else:
        auth_mode = "allowlist"
    allowlist_count = len([item for item in config.admin_clerk_user_ids if item != "*"])
    return (
        f"Admin auth mode: {auth_mode} | environment={mode} | "
        f"allowlist_count={allowlist_count} | wildcard_local={config.admin_allow_all_local}"
    )
