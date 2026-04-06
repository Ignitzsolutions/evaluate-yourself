"""add trial code suffix and dashboard performance indexes

Revision ID: 20260223_0005
Revises: 20260223_0004
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260223_0005"
down_revision = "20260223_0004"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return any(column.get("name") == column_name for column in inspector.get_columns(table_name))


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return any(index.get("name") == index_name for index in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "trial_codes") and not _column_exists(bind, "trial_codes", "code_suffix"):
        op.add_column("trial_codes", sa.Column("code_suffix", sa.String(length=24), nullable=True))
    if not _index_exists(bind, "trial_codes", "ix_trial_codes_code_suffix"):
        op.create_index("ix_trial_codes_code_suffix", "trial_codes", ["code_suffix"], unique=False)

    if not _index_exists(bind, "users", "ix_users_created_at"):
        op.create_index("ix_users_created_at", "users", ["created_at"], unique=False)
    if not _index_exists(bind, "users", "ix_users_last_login_at"):
        op.create_index("ix_users_last_login_at", "users", ["last_login_at"], unique=False)
    if not _index_exists(bind, "interview_sessions", "ix_interview_sessions_started_at"):
        op.create_index("ix_interview_sessions_started_at", "interview_sessions", ["started_at"], unique=False)
    if not _index_exists(bind, "trial_codes", "ix_trial_codes_created_at"):
        op.create_index("ix_trial_codes_created_at", "trial_codes", ["created_at"], unique=False)
    if not _index_exists(bind, "trial_codes", "ix_trial_codes_redeemed_at"):
        op.create_index("ix_trial_codes_redeemed_at", "trial_codes", ["redeemed_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if _index_exists(bind, "trial_codes", "ix_trial_codes_redeemed_at"):
        op.drop_index("ix_trial_codes_redeemed_at", table_name="trial_codes")
    if _index_exists(bind, "trial_codes", "ix_trial_codes_created_at"):
        op.drop_index("ix_trial_codes_created_at", table_name="trial_codes")
    if _index_exists(bind, "interview_sessions", "ix_interview_sessions_started_at"):
        op.drop_index("ix_interview_sessions_started_at", table_name="interview_sessions")
    if _index_exists(bind, "users", "ix_users_last_login_at"):
        op.drop_index("ix_users_last_login_at", table_name="users")
    if _index_exists(bind, "users", "ix_users_created_at"):
        op.drop_index("ix_users_created_at", table_name="users")

    if _index_exists(bind, "trial_codes", "ix_trial_codes_code_suffix"):
        op.drop_index("ix_trial_codes_code_suffix", table_name="trial_codes")
    if _column_exists(bind, "trial_codes", "code_suffix"):
        op.drop_column("trial_codes", "code_suffix")
