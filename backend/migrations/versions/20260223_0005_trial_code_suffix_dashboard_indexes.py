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


def upgrade() -> None:
    op.add_column("trial_codes", sa.Column("code_suffix", sa.String(length=24), nullable=True))
    op.create_index("ix_trial_codes_code_suffix", "trial_codes", ["code_suffix"], unique=False)

    op.create_index("ix_users_created_at", "users", ["created_at"], unique=False)
    op.create_index("ix_users_last_login_at", "users", ["last_login_at"], unique=False)
    op.create_index("ix_interview_sessions_started_at", "interview_sessions", ["started_at"], unique=False)
    op.create_index("ix_trial_codes_created_at", "trial_codes", ["created_at"], unique=False)
    op.create_index("ix_trial_codes_redeemed_at", "trial_codes", ["redeemed_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_trial_codes_redeemed_at", table_name="trial_codes")
    op.drop_index("ix_trial_codes_created_at", table_name="trial_codes")
    op.drop_index("ix_interview_sessions_started_at", table_name="interview_sessions")
    op.drop_index("ix_users_last_login_at", table_name="users")
    op.drop_index("ix_users_created_at", table_name="users")

    op.drop_index("ix_trial_codes_code_suffix", table_name="trial_codes")
    op.drop_column("trial_codes", "code_suffix")
