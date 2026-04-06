"""make trial codes non-expiring by default

Revision ID: 20260318_0010
Revises: 20260315_0009
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20260318_0010"
down_revision = "20260315_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "trial_codes" in tables:
        with op.batch_alter_table("trial_codes") as batch_op:
            batch_op.alter_column("expires_at", existing_type=sa.DateTime(timezone=True), nullable=True)

        bind.execute(
            sa.text(
                """
                UPDATE trial_codes
                SET expires_at = NULL
                WHERE status IN ('ACTIVE', 'REDEEMED')
                """
            )
        )

    if "user_entitlements" in tables:
        bind.execute(
            sa.text(
                """
                UPDATE user_entitlements
                SET expires_at = NULL
                WHERE source_type = 'TRIAL_CODE'
                  AND is_active = 1
                  AND revoked_at IS NULL
                """
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "trial_codes" in tables:
        bind.execute(
            sa.text(
                """
                UPDATE trial_codes
                SET expires_at = COALESCE(expires_at, CURRENT_TIMESTAMP)
                """
            )
        )
        with op.batch_alter_table("trial_codes") as batch_op:
            batch_op.alter_column("expires_at", existing_type=sa.DateTime(timezone=True), nullable=False)
