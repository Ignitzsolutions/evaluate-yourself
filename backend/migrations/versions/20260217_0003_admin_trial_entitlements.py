"""add admin candidate fields, trial codes, and user entitlements

Revision ID: 20260217_0003
Revises: 20260212_0002
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260217_0003"
down_revision = "20260212_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone_e164", sa.String(), nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")))
    op.add_column("users", sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("0")))
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_phone_e164", "users", ["phone_e164"], unique=True)

    op.create_table(
        "trial_codes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_clerk_user_id", sa.String(), nullable=False),
        sa.Column("redeemed_by_clerk_user_id", sa.String(), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meta_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_trial_codes_code", "trial_codes", ["code"], unique=True)
    op.create_index("ix_trial_codes_redeemed_by_clerk_user_id", "trial_codes", ["redeemed_by_clerk_user_id"], unique=False)

    op.create_table(
        "user_entitlements",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("plan_tier", sa.String(), nullable=False, server_default=sa.text("'trial'")),
        sa.Column("duration_minutes_effective", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("starts_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_entitlements_clerk_user_id", "user_entitlements", ["clerk_user_id"], unique=False)
    op.create_index("ix_user_entitlements_source_id", "user_entitlements", ["source_id"], unique=False)
    op.create_index(
        "ix_user_entitlements_user_source_active",
        "user_entitlements",
        ["clerk_user_id", "source_type", "source_id", "is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_user_entitlements_user_source_active", table_name="user_entitlements")
    op.drop_index("ix_user_entitlements_source_id", table_name="user_entitlements")
    op.drop_index("ix_user_entitlements_clerk_user_id", table_name="user_entitlements")
    op.drop_table("user_entitlements")

    op.drop_index("ix_trial_codes_redeemed_by_clerk_user_id", table_name="trial_codes")
    op.drop_index("ix_trial_codes_code", table_name="trial_codes")
    op.drop_table("trial_codes")

    op.drop_index("ix_users_phone_e164", table_name="users")
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "is_deleted")
    op.drop_column("users", "is_active")
    op.drop_column("users", "phone_e164")
