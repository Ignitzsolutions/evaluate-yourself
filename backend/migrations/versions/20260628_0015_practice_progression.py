"""communication practice progression

Adds:
  - communication_practice_attempts (per-attempt scoring history for progression UI)

Revision ID: 20260628_0015
Revises: 20260430_0014
Create Date: 2026-06-28
"""

from alembic import op
import sqlalchemy as sa


revision = "20260628_0015"
down_revision = "20260430_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "communication_practice_attempts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False, index=True),
        sa.Column("pack_id", sa.String(), nullable=False, index=True),
        sa.Column("prompt_id", sa.String(), nullable=True, index=True),
        sa.Column("target_sentence", sa.Text(), nullable=True),
        sa.Column("spoken_text", sa.Text(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coverage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("filler_per_100", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pacing_band", sa.String(), nullable=True),
        sa.Column("quality_flags", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            index=True,
        ),
    )
    op.create_index(
        "ix_practice_attempts_user_created",
        "communication_practice_attempts",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_practice_attempts_user_created", table_name="communication_practice_attempts")
    op.drop_table("communication_practice_attempts")
