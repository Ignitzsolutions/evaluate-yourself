import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"


def run_alembic(database_url: str, *args: str) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    env.pop("ADMIN_CLERK_USER_IDS", None)
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )


def test_self_hosted_auth_migration_reaches_single_head(tmp_path):
    db_path = tmp_path / "auth_migration.sqlite"
    database_url = f"sqlite:///{db_path}"

    run_alembic(database_url, "upgrade", "20260408_0008")

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO users (id, clerk_user_id, email, full_name, is_active, is_deleted)
                VALUES ('user-1', 'clerk_1', 'beta@example.com', 'Beta Tester', 1, 0)
                """
            )
        )

    run_alembic(database_url, "upgrade", "head")

    with engine.connect() as connection:
        inspector = inspect(connection)
        user_columns = {column["name"]: column for column in inspector.get_columns("users")}
        assert {"password_hash", "is_admin", "email_verified"} <= set(user_columns)
        assert user_columns["clerk_user_id"]["nullable"] is True
        assert connection.execute(text("SELECT email_verified FROM users WHERE id='user-1'")).scalar() == 1

        heads = connection.execute(
            text("SELECT version_num FROM alembic_version ORDER BY version_num")
        ).scalars().all()
        assert heads == ["20260429_0013"]
