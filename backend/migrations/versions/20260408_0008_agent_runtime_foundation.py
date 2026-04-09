"""add agent runtime foundation tables

Revision ID: 20260408_0008
Revises: 20260225_0008
Create Date: 2026-04-08 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260408_0008"
down_revision = "20260225_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interview_rounds",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("round_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("phase", sa.String(), nullable=False, server_default="intro"),
        sa.Column("agent_owner", sa.String(), nullable=False, server_default="orchestrator"),
        sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"),
        sa.Column("question_id", sa.String(), nullable=True),
        sa.Column("question_text", sa.Text(), nullable=True),
        sa.Column("handoff_reason", sa.String(), nullable=True),
        sa.Column("summary_json", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_interview_rounds_session_id", "interview_rounds", ["session_id"], unique=False)
    op.create_index("ix_interview_rounds_clerk_user_id", "interview_rounds", ["clerk_user_id"], unique=False)

    op.create_table(
        "session_memory_snapshots",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("round_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("snapshot_kind", sa.String(), nullable=False, server_default="carry_forward"),
        sa.Column("resume_token", sa.String(), nullable=True),
        sa.Column("memory_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_session_memory_snapshots_session_id", "session_memory_snapshots", ["session_id"], unique=False)
    op.create_index("ix_session_memory_snapshots_clerk_user_id", "session_memory_snapshots", ["clerk_user_id"], unique=False)
    op.create_index("ix_session_memory_snapshots_resume_token", "session_memory_snapshots", ["resume_token"], unique=False)

    op.create_table(
        "evidence_artifacts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("artifact_type", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False, server_default="client_capture"),
        sa.Column("trust_level", sa.String(), nullable=False, server_default="trusted"),
        sa.Column("artifact_status", sa.String(), nullable=False, server_default="READY"),
        sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("word_timestamps_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("capture_integrity_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_evidence_artifacts_session_id", "evidence_artifacts", ["session_id"], unique=False)
    op.create_index("ix_evidence_artifacts_clerk_user_id", "evidence_artifacts", ["clerk_user_id"], unique=False)
    op.create_index("ix_evidence_artifacts_artifact_type", "evidence_artifacts", ["artifact_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_evidence_artifacts_artifact_type", table_name="evidence_artifacts")
    op.drop_index("ix_evidence_artifacts_clerk_user_id", table_name="evidence_artifacts")
    op.drop_index("ix_evidence_artifacts_session_id", table_name="evidence_artifacts")
    op.drop_table("evidence_artifacts")

    op.drop_index("ix_session_memory_snapshots_resume_token", table_name="session_memory_snapshots")
    op.drop_index("ix_session_memory_snapshots_clerk_user_id", table_name="session_memory_snapshots")
    op.drop_index("ix_session_memory_snapshots_session_id", table_name="session_memory_snapshots")
    op.drop_table("session_memory_snapshots")

    op.drop_index("ix_interview_rounds_clerk_user_id", table_name="interview_rounds")
    op.drop_index("ix_interview_rounds_session_id", table_name="interview_rounds")
    op.drop_table("interview_rounds")
