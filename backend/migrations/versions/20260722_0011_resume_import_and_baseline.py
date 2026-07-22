"""Add resume import, portfolio, and baseline metadata.

Revision ID: 20260722_0011
Revises: 20260722_0010
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_0011"
down_revision = "20260722_0010"
branch_labels = None
depends_on = None


def _has_column(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    columns = [
        ("portfolio_url", sa.String()),
        ("resume_text", sa.Text()),
        ("resume_draft_json", sa.Text()),
        ("baseline_capture_json", sa.Text()),
    ]
    for name, column_type in columns:
        if not _has_column(bind, "candidate_profiles", name):
            op.add_column("candidate_profiles", sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    for name in [
        "baseline_capture_json",
        "resume_draft_json",
        "resume_text",
        "portfolio_url",
    ]:
        if _has_column(bind, "candidate_profiles", name):
            op.drop_column("candidate_profiles", name)
