"""add admin console indexes for interview status and report date

Revision ID: 20260224_0006
Revises: 20260223_0005
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260224_0006"
down_revision = "20260223_0005"
branch_labels = None
depends_on = None


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    indexes = inspector.get_indexes(table_name)
    return any(idx.get("name") == index_name for idx in indexes)


def upgrade() -> None:
    bind = op.get_bind()
    if not _index_exists(bind, "interview_sessions", "ix_interview_sessions_status"):
        op.create_index("ix_interview_sessions_status", "interview_sessions", ["status"], unique=False)
    if not _index_exists(bind, "interview_reports", "ix_interview_reports_date"):
        op.create_index("ix_interview_reports_date", "interview_reports", ["date"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    if _index_exists(bind, "interview_reports", "ix_interview_reports_date"):
        op.drop_index("ix_interview_reports_date", table_name="interview_reports")
    if _index_exists(bind, "interview_sessions", "ix_interview_sessions_status"):
        op.drop_index("ix_interview_sessions_status", table_name="interview_sessions")

