"""add interview gaze events table

Revision ID: 20260223_0004
Revises: 20260217_0003
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260223_0004"
down_revision = "20260217_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interview_gaze_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(), nullable=False, server_default=sa.text("'opencv_haar_v1'")),
        sa.Column("extra_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index(
        "ix_interview_gaze_events_session_id",
        "interview_gaze_events",
        ["session_id"],
        unique=False,
    )
    op.create_index(
        "ix_interview_gaze_events_clerk_user_id",
        "interview_gaze_events",
        ["clerk_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_interview_gaze_events_event_type",
        "interview_gaze_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        "ix_interview_gaze_events_session_started",
        "interview_gaze_events",
        ["session_id", "started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_interview_gaze_events_session_started", table_name="interview_gaze_events")
    op.drop_index("ix_interview_gaze_events_event_type", table_name="interview_gaze_events")
    op.drop_index("ix_interview_gaze_events_clerk_user_id", table_name="interview_gaze_events")
    op.drop_index("ix_interview_gaze_events_session_id", table_name="interview_gaze_events")
    op.drop_table("interview_gaze_events")

