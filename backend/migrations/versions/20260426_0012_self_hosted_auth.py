"""Add self-hosted auth columns: password_hash, is_admin, email_verified.

Make clerk_user_id nullable for new non-Clerk users.
Seed existing Clerk users as email_verified=True.
Seed admin flag from ADMIN_CLERK_USER_IDS env var.
"""

import os
from alembic import op
import sqlalchemy as sa

revision = "20260426_0012"
down_revision = "20260408_0008"
branch_labels = None
depends_on = None


def upgrade():
    # --- Add new columns ---
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("0")))
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("0")))

    # --- Make clerk_user_id nullable ---
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("clerk_user_id", existing_type=sa.String(), nullable=True)

    # --- Seed data ---
    conn = op.get_bind()

    # All existing users came through Clerk, so their emails are verified
    conn.execute(sa.text("UPDATE users SET email_verified = 1 WHERE email IS NOT NULL"))

    # Seed admin flag from the env-var allowlist used until now
    admin_ids_raw = os.getenv("ADMIN_CLERK_USER_IDS", "")
    admin_ids = [a.strip() for a in admin_ids_raw.split(",") if a.strip() and a.strip() != "*"]
    if admin_ids:
        placeholders = ", ".join(f":id{i}" for i in range(len(admin_ids)))
        params = {f"id{i}": v for i, v in enumerate(admin_ids)}
        conn.execute(
            sa.text(f"UPDATE users SET is_admin = 1 WHERE clerk_user_id IN ({placeholders})"),
            params,
        )


def downgrade():
    op.drop_column("users", "email_verified")
    op.drop_column("users", "is_admin")
    op.drop_column("users", "password_hash")
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("clerk_user_id", existing_type=sa.String(), nullable=False)
