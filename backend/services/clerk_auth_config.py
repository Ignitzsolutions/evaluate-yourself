from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Optional


def _environment(env: Mapping[str, str]) -> str:
    return str(
        env.get("ENV")
        or env.get("APP_ENV")
        or env.get("ENVIRONMENT")
        or env.get("PYTHON_ENV")
        or env.get("NODE_ENV")
        or "development"
    ).strip().lower()


def _key_mode(value: Optional[str], prefix: str) -> str:
    raw = str(value or "").strip()
    if raw.startswith(f"{prefix}_live_"):
        return "live"
    if raw.startswith(f"{prefix}_test_"):
        return "test"
    return "missing" if not raw else "unknown"


@dataclass(frozen=True)
class ClerkAuthConfig:
    environment: str
    is_production: bool
    publishable_key: str
    secret_key: str
    jwks_url: str
    publishable_mode: str
    secret_mode: str

    @property
    def uses_test_instance(self) -> bool:
        return self.publishable_mode == "test" or self.secret_mode == "test"


def resolve_clerk_auth_config(env: Mapping[str, str]) -> ClerkAuthConfig:
    publishable_key = str(env.get("CLERK_PUBLISHABLE_KEY") or "").strip()
    secret_key = str(env.get("CLERK_SECRET_KEY") or "").strip()
    return ClerkAuthConfig(
        environment=_environment(env),
        is_production=_environment(env) == "production",
        publishable_key=publishable_key,
        secret_key=secret_key,
        jwks_url=str(env.get("CLERK_JWKS_URL") or "").strip(),
        publishable_mode=_key_mode(publishable_key, "pk"),
        secret_mode=_key_mode(secret_key, "sk"),
    )


def validate_clerk_auth_config(config: ClerkAuthConfig) -> None:
    modes = {config.publishable_mode, config.secret_mode}
    if "missing" in modes:
        raise RuntimeError("CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must be set.")
    if config.publishable_mode != config.secret_mode:
        raise RuntimeError("Clerk publishable and secret keys must use the same Clerk instance mode.")
    if config.is_production and config.uses_test_instance:
        raise RuntimeError("Production Clerk configuration must use live keys.")


def build_clerk_auth_summary(config: ClerkAuthConfig) -> str:
    jwks = "set" if config.jwks_url else "missing"
    return (
        f"environment={config.environment} "
        f"publishable={config.publishable_mode} secret={config.secret_mode} jwks={jwks}"
    )
