"""add trial code display name

Revision ID: 20260315_0009
Revises: 20260225_0008
Create Date: 2026-03-15
"""

from alembic import op
import sqlalchemy as sa


revision = "20260315_0009"
down_revision = "20260225_0008"
branch_labels = None
depends_on = None


def _column_names(bind, table_name: str) -> set[str]:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    if "display_name" not in _column_names(bind, "trial_codes"):
        op.add_column("trial_codes", sa.Column("display_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if "display_name" in _column_names(bind, "trial_codes"):
        op.drop_column("trial_codes", "display_name")
