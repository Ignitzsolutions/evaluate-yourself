"""add onboarding profile and durable interview sessions tables

Revision ID: 20260212_0002
Revises: 20260208_0001
Create Date: 2026-02-12
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260212_0002"
down_revision = "20260208_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("user_category", sa.String(), nullable=False),
        sa.Column("primary_goal", sa.String(), nullable=False),
        sa.Column("target_roles", sa.Text(), nullable=True),
        sa.Column("industries", sa.Text(), nullable=True),
        sa.Column("interview_timeline", sa.String(), nullable=False),
        sa.Column("prep_intensity", sa.String(), nullable=False),
        sa.Column("learning_style", sa.String(), nullable=False),
        sa.Column("consent_data_use", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("education_level", sa.String(), nullable=True),
        sa.Column("graduation_timeline", sa.String(), nullable=True),
        sa.Column("major_domain", sa.String(), nullable=True),
        sa.Column("placement_readiness", sa.String(), nullable=True),
        sa.Column("current_role", sa.String(), nullable=True),
        sa.Column("experience_band", sa.String(), nullable=True),
        sa.Column("management_scope", sa.String(), nullable=True),
        sa.Column("domain_expertise", sa.Text(), nullable=True),
        sa.Column("target_company_type", sa.String(), nullable=True),
        sa.Column("career_transition_intent", sa.String(), nullable=True),
        sa.Column("notice_period_band", sa.String(), nullable=True),
        sa.Column("career_comp_band", sa.String(), nullable=True),
        sa.Column("interview_urgency", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_profiles_clerk_user_id", "user_profiles", ["clerk_user_id"], unique=True)

    op.create_table(
        "interview_sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("interview_type", sa.String(), nullable=True),
        sa.Column("difficulty", sa.String(), nullable=True),
        sa.Column("duration_minutes_requested", sa.Integer(), nullable=True),
        sa.Column("duration_minutes_effective", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("report_id", sa.String(), nullable=True),
        sa.Column("session_meta_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_interview_sessions_session_id", "interview_sessions", ["session_id"], unique=True)
    op.create_index("ix_interview_sessions_clerk_user_id", "interview_sessions", ["clerk_user_id"], unique=False)
    op.create_index("ix_interview_sessions_report_id", "interview_sessions", ["report_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_interview_sessions_report_id", table_name="interview_sessions")
    op.drop_index("ix_interview_sessions_clerk_user_id", table_name="interview_sessions")
    op.drop_index("ix_interview_sessions_session_id", table_name="interview_sessions")
    op.drop_table("interview_sessions")

    op.drop_index("ix_user_profiles_clerk_user_id", table_name="user_profiles")
    op.drop_table("user_profiles")
