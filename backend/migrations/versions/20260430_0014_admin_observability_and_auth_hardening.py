"""admin observability + auth hardening

Adds:
  - llm_usage_events (token + realtime usage accounting)
  - user_mfa (TOTP enrollment)
  - refresh_tokens (rotation + reuse detection)
  - auth_audit_events (append-only audit log)

Revision ID: 20260430_0014
Revises: 20260429_0013
Create Date: 2026-04-30
"""

from alembic import op
import sqlalchemy as sa


revision = "20260430_0014"
down_revision = "20260429_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_usage_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=True, index=True),
        sa.Column("clerk_user_id", sa.String(), nullable=True, index=True),
        sa.Column("session_id", sa.String(), nullable=True, index=True),
        sa.Column("route", sa.String(), nullable=True, index=True),
        sa.Column("provider", sa.String(), nullable=False, server_default="openai"),
        sa.Column("model", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False, server_default="chat"),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("audio_input_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("audio_output_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("est_cost_usd_micro", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )
    op.create_index("ix_llm_usage_events_user_created", "llm_usage_events", ["user_id", "created_at"])
    op.create_index("ix_llm_usage_events_route_created", "llm_usage_events", ["route", "created_at"])

    op.create_table(
        "user_mfa",
        sa.Column("user_id", sa.String(), primary_key=True),
        sa.Column("secret_encrypted", sa.String(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recovery_codes_hashed", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("jti", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False, index=True),
        sa.Column("family_id", sa.String(), nullable=False, index=True),
        sa.Column("parent_jti", sa.String(), nullable=True),
        sa.Column("device_label", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.String(), nullable=True),
    )

    op.create_table(
        "auth_audit_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=True, index=True),
        sa.Column("email", sa.String(), nullable=True, index=True),
        sa.Column("event_type", sa.String(), nullable=False, index=True),
        sa.Column("outcome", sa.String(), nullable=False),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )
    op.create_index("ix_auth_audit_events_user_created", "auth_audit_events", ["user_id", "created_at"])
    op.create_index("ix_auth_audit_events_type_created", "auth_audit_events", ["event_type", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_auth_audit_events_type_created", table_name="auth_audit_events")
    op.drop_index("ix_auth_audit_events_user_created", table_name="auth_audit_events")
    op.drop_table("auth_audit_events")
    op.drop_table("refresh_tokens")
    op.drop_table("user_mfa")
    op.drop_index("ix_llm_usage_events_route_created", table_name="llm_usage_events")
    op.drop_index("ix_llm_usage_events_user_created", table_name="llm_usage_events")
    op.drop_table("llm_usage_events")
