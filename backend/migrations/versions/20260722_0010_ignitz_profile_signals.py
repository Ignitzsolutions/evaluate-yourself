"""add ignitz profile signal fields

Revision ID: 20260722_0010
Revises: 20260501_0015
Create Date: 2026-07-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20260722_0010"
down_revision = "20260501_0015"
branch_labels = None
depends_on = None


def _has_column(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    additions = [
        ("region", sa.String(), {}),
        ("timezone", sa.String(), {}),
        ("seniority", sa.String(), {}),
        ("years_of_experience", sa.Integer(), {}),
        ("current_title", sa.String(), {}),
        ("target_interview_format", sa.String(), {}),
        ("target_job_description", sa.Text(), {}),
        ("target_job_url", sa.String(), {}),
    ]
    for name, coltype, kwargs in additions:
        if not _has_column(bind, "candidate_profiles", name):
            op.add_column("candidate_profiles", sa.Column(name, coltype, nullable=True, **kwargs))


def downgrade() -> None:
    bind = op.get_bind()
    for name in [
        "target_job_url",
        "target_job_description",
        "target_interview_format",
        "current_title",
        "years_of_experience",
        "seniority",
        "timezone",
        "region",
    ]:
        if _has_column(bind, "candidate_profiles", name):
            op.drop_column("candidate_profiles", name)
