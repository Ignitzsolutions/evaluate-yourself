"""add identity foundation and admin export jobs

Revision ID: 20260225_0007
Revises: 20260224_0006
Create Date: 2026-02-25
"""

from alembic import op
import sqlalchemy as sa


revision = "20260225_0007"
down_revision = "20260224_0006"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return any(col.get("name") == column_name for col in inspector.get_columns(table_name))


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return any(idx.get("name") == index_name for idx in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "auth_identities"):
        op.create_table(
            "auth_identities",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("provider", sa.String(), nullable=False, server_default="clerk"),
            sa.Column("provider_user_id", sa.String(), nullable=False),
            sa.Column("provider_instance", sa.String(), nullable=True),
            sa.Column("external_id", sa.String(), nullable=True),
            sa.Column("legacy_provider_user_id", sa.String(), nullable=True),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("raw_claims_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("provider", "provider_user_id", name="uq_auth_identities_provider_subject"),
        )
        op.create_index("ix_auth_identities_user_id", "auth_identities", ["user_id"], unique=False)
        op.create_index("ix_auth_identities_external_id", "auth_identities", ["external_id"], unique=False)
        op.create_index("ix_auth_identities_legacy_provider_user_id", "auth_identities", ["legacy_provider_user_id"], unique=False)

    if not _table_exists(bind, "user_emails"):
        op.create_table(
            "user_emails",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("normalized_email", sa.String(), nullable=False),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("source", sa.String(), nullable=False, server_default="clerk"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("normalized_email", name="uq_user_emails_normalized_email"),
        )
        op.create_index("ix_user_emails_user_id", "user_emails", ["user_id"], unique=False)

    if not _table_exists(bind, "user_phones"):
        op.create_table(
            "user_phones",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("phone_e164", sa.String(), nullable=False),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("country_code", sa.String(), nullable=True),
            sa.Column("source", sa.String(), nullable=False, server_default="clerk"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("phone_e164", name="uq_user_phones_phone_e164"),
        )
        op.create_index("ix_user_phones_user_id", "user_phones", ["user_id"], unique=False)

    if not _table_exists(bind, "candidate_profiles"):
        op.create_table(
            "candidate_profiles",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("full_name_override", sa.String(), nullable=True),
            sa.Column("candidate_type", sa.String(), nullable=False, server_default="student"),
            sa.Column("state_code", sa.String(), nullable=True),
            sa.Column("city", sa.String(), nullable=True),
            sa.Column("country_code", sa.String(), nullable=False, server_default="IN"),
            sa.Column("university_name", sa.String(), nullable=True),
            sa.Column("university_normalized", sa.String(), nullable=True),
            sa.Column("university_id", sa.String(), nullable=True),
            sa.Column("degree_level", sa.String(), nullable=True),
            sa.Column("degree_name", sa.String(), nullable=True),
            sa.Column("branch_specialization", sa.String(), nullable=True),
            sa.Column("graduation_year", sa.Integer(), nullable=True),
            sa.Column("current_year_of_study", sa.String(), nullable=True),
            sa.Column("experience_level", sa.String(), nullable=True),
            sa.Column("primary_stream", sa.String(), nullable=True),
            sa.Column("target_roles_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("target_companies_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("skills_self_reported_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("resume_url", sa.String(), nullable=True),
            sa.Column("linkedin_url", sa.String(), nullable=True),
            sa.Column("github_url", sa.String(), nullable=True),
            sa.Column("consent_data_use", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("consent_contact", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("profile_completion_score", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("profile_completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", name="uq_candidate_profiles_user_id"),
        )
        op.create_index("ix_candidate_profiles_primary_stream", "candidate_profiles", ["primary_stream"], unique=False)
        op.create_index("ix_candidate_profiles_state_code", "candidate_profiles", ["state_code"], unique=False)

    if not _table_exists(bind, "candidate_profile_versions"):
        op.create_table(
            "candidate_profile_versions",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("version_no", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("snapshot_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("source", sa.String(), nullable=False, server_default="onboarding_submit"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_candidate_profile_versions_user_id", "candidate_profile_versions", ["user_id"], unique=False)

    if not _table_exists(bind, "admin_export_jobs"):
        op.create_table(
            "admin_export_jobs",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("created_by_user_id", sa.String(), nullable=False),
            sa.Column("export_type", sa.String(), nullable=False),
            sa.Column("filters_json", sa.Text(), nullable=True),
            sa.Column("columns_json", sa.Text(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="queued"),
            sa.Column("row_count", sa.Integer(), nullable=True),
            sa.Column("file_storage_kind", sa.String(), nullable=False, server_default="db_blob"),
            sa.Column("file_url", sa.String(), nullable=True),
            sa.Column("file_name", sa.String(), nullable=True),
            sa.Column("mime_type", sa.String(), nullable=True, server_default="text/csv"),
            sa.Column("file_content_text", sa.Text(), nullable=True),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_admin_export_jobs_created_by_user_id", "admin_export_jobs", ["created_by_user_id"], unique=False)
        op.create_index("ix_admin_export_jobs_export_type", "admin_export_jobs", ["export_type"], unique=False)
        op.create_index("ix_admin_export_jobs_status", "admin_export_jobs", ["status"], unique=False)

    # Additive future-proof columns on legacy tables (safe, nullable).
    for table_name, column_name in [
        ("interview_sessions", "user_id"),
        ("user_entitlements", "user_id"),
        ("interview_gaze_events", "user_id"),
        ("trial_codes", "created_by_user_id"),
        ("trial_codes", "redeemed_by_user_id"),
    ]:
        if not _column_exists(bind, table_name, column_name):
            op.add_column(table_name, sa.Column(column_name, sa.String(), nullable=True))

    # Useful indexes for future cutover/backfill and current reporting.
    if _table_exists(bind, "interview_sessions") and _column_exists(bind, "interview_sessions", "user_id"):
        if not _index_exists(bind, "interview_sessions", "ix_interview_sessions_user_id"):
            op.create_index("ix_interview_sessions_user_id", "interview_sessions", ["user_id"], unique=False)
    if _table_exists(bind, "user_entitlements") and _column_exists(bind, "user_entitlements", "user_id"):
        if not _index_exists(bind, "user_entitlements", "ix_user_entitlements_user_id"):
            op.create_index("ix_user_entitlements_user_id", "user_entitlements", ["user_id"], unique=False)
    if _table_exists(bind, "interview_gaze_events") and _column_exists(bind, "interview_gaze_events", "user_id"):
        if not _index_exists(bind, "interview_gaze_events", "ix_interview_gaze_events_user_id"):
            op.create_index("ix_interview_gaze_events_user_id", "interview_gaze_events", ["user_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    for table_name, index_name in [
        ("interview_gaze_events", "ix_interview_gaze_events_user_id"),
        ("user_entitlements", "ix_user_entitlements_user_id"),
        ("interview_sessions", "ix_interview_sessions_user_id"),
    ]:
        if _index_exists(bind, table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    for table_name, column_name in [
        ("trial_codes", "redeemed_by_user_id"),
        ("trial_codes", "created_by_user_id"),
        ("interview_gaze_events", "user_id"),
        ("user_entitlements", "user_id"),
        ("interview_sessions", "user_id"),
    ]:
        if _column_exists(bind, table_name, column_name):
            op.drop_column(table_name, column_name)

    for table_name in [
        "admin_export_jobs",
        "candidate_profile_versions",
        "candidate_profiles",
        "user_phones",
        "user_emails",
        "auth_identities",
    ]:
        if _table_exists(bind, table_name):
            op.drop_table(table_name)
