"""add waitlist and trial feedback tables

Revision ID: 20260405_0011
Revises: 20260318_0010
Create Date: 2026-04-05
"""

from alembic import op
import sqlalchemy as sa


revision = "20260405_0011"
down_revision = "20260318_0010"
branch_labels = None
depends_on = None


def _table_names(bind):
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)

    if "launch_waitlist_signups" not in tables:
        op.create_table(
            "launch_waitlist_signups",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("normalized_email", sa.String(), nullable=False),
            sa.Column("source_page", sa.String(), nullable=False),
            sa.Column("intent", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("meta_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_launch_waitlist_signups_normalized_email", "launch_waitlist_signups", ["normalized_email"], unique=True)
        op.create_index("ix_launch_waitlist_signups_source_page", "launch_waitlist_signups", ["source_page"], unique=False)
        op.create_index("ix_launch_waitlist_signups_created_at", "launch_waitlist_signups", ["created_at"], unique=False)

    if "trial_feedback" not in tables:
        op.create_table(
            "trial_feedback",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=True),
            sa.Column("clerk_user_id", sa.String(), nullable=True),
            sa.Column("report_id", sa.String(), nullable=False),
            sa.Column("session_id", sa.String(), nullable=True),
            sa.Column("rating", sa.Integer(), nullable=False),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("plan_tier", sa.String(), nullable=True),
            sa.Column("trial_mode", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("source", sa.String(), nullable=False, server_default="post_trial_report"),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_trial_feedback_report_id", "trial_feedback", ["report_id"], unique=True)
        op.create_index("ix_trial_feedback_session_id", "trial_feedback", ["session_id"], unique=False)
        op.create_index("ix_trial_feedback_user_id", "trial_feedback", ["user_id"], unique=False)
        op.create_index("ix_trial_feedback_clerk_user_id", "trial_feedback", ["clerk_user_id"], unique=False)
        op.create_index("ix_trial_feedback_submitted_at", "trial_feedback", ["submitted_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    tables = _table_names(bind)

    if "trial_feedback" in tables:
        op.drop_index("ix_trial_feedback_submitted_at", table_name="trial_feedback")
        op.drop_index("ix_trial_feedback_clerk_user_id", table_name="trial_feedback")
        op.drop_index("ix_trial_feedback_user_id", table_name="trial_feedback")
        op.drop_index("ix_trial_feedback_session_id", table_name="trial_feedback")
        op.drop_index("ix_trial_feedback_report_id", table_name="trial_feedback")
        op.drop_table("trial_feedback")

    if "launch_waitlist_signups" in tables:
        op.drop_index("ix_launch_waitlist_signups_created_at", table_name="launch_waitlist_signups")
        op.drop_index("ix_launch_waitlist_signups_source_page", table_name="launch_waitlist_signups")
        op.drop_index("ix_launch_waitlist_signups_normalized_email", table_name="launch_waitlist_signups")
        op.drop_table("launch_waitlist_signups")
