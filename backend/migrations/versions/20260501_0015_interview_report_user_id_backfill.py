"""backfill interview report user ids

Revision ID: 20260501_0015
Revises: 20260430_0014
Create Date: 2026-05-01
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0015"
down_revision = "20260430_0014"
branch_labels = None
depends_on = None


def _backfill_interview_report_user_ids(connection) -> None:
    connection.execute(
        sa.text(
            """
            UPDATE interview_reports
            SET user_id = (
                SELECT users.id
                FROM users
                WHERE users.clerk_user_id = interview_reports.user_id
            )
            WHERE user_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM users
                WHERE users.clerk_user_id = interview_reports.user_id
              )
            """
        )
    )


def _restore_interview_report_clerk_ids(connection) -> None:
    connection.execute(
        sa.text(
            """
            UPDATE interview_reports
            SET user_id = (
                SELECT users.clerk_user_id
                FROM users
                WHERE users.id = interview_reports.user_id
            )
            WHERE user_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM users
                WHERE users.id = interview_reports.user_id
              )
            """
        )
    )


def upgrade() -> None:
    _backfill_interview_report_user_ids(op.get_bind())


def downgrade() -> None:
    _restore_interview_report_clerk_ids(op.get_bind())
