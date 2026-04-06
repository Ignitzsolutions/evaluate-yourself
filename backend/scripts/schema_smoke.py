#!/usr/bin/env python3
"""Verify database schema is at Alembic head and critical columns exist."""

from __future__ import annotations

import sys
from pathlib import Path

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect


BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.db.database import engine  # noqa: E402


REQUIRED_COLUMNS = {
    "users": {"clerk_user_id", "email", "phone_e164", "is_active", "is_deleted"},
    "auth_identities": {"provider", "provider_user_id", "user_id"},
    "user_emails": {"user_id", "normalized_email", "is_primary", "is_verified"},
    "user_phones": {"user_id", "phone_e164", "is_primary", "is_verified"},
    "trial_codes": {"display_name", "status", "code"},
    "launch_waitlist_signups": {"normalized_email", "source_page", "intent", "status"},
    "trial_feedback": {"report_id", "rating", "trial_mode", "submitted_at"},
    "interview_gaze_events": {"event_type", "source"},
    "interview_reports": {"metrics", "transcript"},
}


def check_required_schema(inspector) -> str | None:
    for table_name, expected_columns in REQUIRED_COLUMNS.items():
        if not inspector.has_table(table_name):
            return f"❌ Missing required table: {table_name}"
        found_columns = {column["name"] for column in inspector.get_columns(table_name)}
        missing_columns = sorted(expected_columns - found_columns)
        if missing_columns:
            return f"❌ Missing columns in {table_name}: {', '.join(missing_columns)}"
    return None


def main() -> int:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    expected_heads = set(script.get_heads())

    with engine.connect() as connection:
        current_revision = MigrationContext.configure(connection).get_current_revision()
        inspector = inspect(connection)

        if expected_heads and current_revision not in expected_heads:
            print(
                f"❌ Schema revision mismatch. current={current_revision or 'none'} expected_head={','.join(sorted(expected_heads))}"
            )
            return 1

        schema_error = check_required_schema(inspector)
        if schema_error:
            print(schema_error)
            return 1

    print("✅ Schema smoke passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
