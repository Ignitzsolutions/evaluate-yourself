from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


def _normalized_environment(env: Mapping[str, str]) -> str:
    return (
        env.get("ENV")
        or env.get("ENVIRONMENT")
        or env.get("PYTHON_ENV")
        or env.get("NODE_ENV")
        or ""
    ).strip().lower() or "development"


def _key_mode(raw_key: str) -> str:
    value = (raw_key or "").strip()
    if value.startswith("pk_live_") or value.startswith("sk_live_"):
        return "live"
    if value.startswith("pk_test_") or value.startswith("sk_test_"):
        return "test"
    return "missing" if not value else "unknown"


@dataclass(frozen=True)
class ClerkAuthConfig:
    environment: str
    is_production: bool
    publishable_key_mode: str
    secret_key_mode: str
    jwks_url: str

    @property
    def uses_test_instance(self) -> bool:
        return "test" in {self.publishable_key_mode, self.secret_key_mode}


def resolve_clerk_auth_config(env: Mapping[str, str]) -> ClerkAuthConfig:
    environment = _normalized_environment(env)
    is_production = environment == "production"
    publishable_key_mode = _key_mode(env.get("CLERK_PUBLISHABLE_KEY", ""))
    secret_key_mode = _key_mode(env.get("CLERK_SECRET_KEY", ""))
    jwks_url = (env.get("CLERK_JWKS_URL") or "").strip()
    return ClerkAuthConfig(
        environment=environment,
        is_production=is_production,
        publishable_key_mode=publishable_key_mode,
        secret_key_mode=secret_key_mode,
        jwks_url=jwks_url,
    )


def validate_clerk_auth_config(config: ClerkAuthConfig) -> None:
    if not config.is_production:
        return
    if config.publishable_key_mode == "missing":
        raise RuntimeError("CLERK_PUBLISHABLE_KEY must be set in production.")
    if config.secret_key_mode == "missing":
        raise RuntimeError("CLERK_SECRET_KEY must be set in production.")
    key_modes = {config.publishable_key_mode, config.secret_key_mode}
    if "unknown" in key_modes:
        raise RuntimeError("Clerk key prefixes are not recognized. Expected pk_* and sk_* values.")
    if len(key_modes) > 1:
        raise RuntimeError("CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must come from the same Clerk instance mode.")
    if key_modes == {"test"}:
        raise RuntimeError("Production requires Clerk live keys. Test keys are not allowed in production.")


def build_clerk_auth_summary(config: ClerkAuthConfig) -> str:
    mode = "production" if config.is_production else "development"
    jwks_state = "set" if config.jwks_url else "derived"
    return (
        f"Clerk auth mode: environment={mode} | "
        f"publishable={config.publishable_key_mode} | secret={config.secret_key_mode} | "
        f"jwks={jwks_state}"
    )
