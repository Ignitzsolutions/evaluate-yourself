"""add admin question bank tables

Revision ID: 20260225_0008
Revises: 20260225_0007
Create Date: 2026-02-25
"""

from alembic import op
import sqlalchemy as sa


revision = "20260225_0008"
down_revision = "20260225_0007"
branch_labels = None
depends_on = None


def _table_exists(bind, table_name: str) -> bool:
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return any(idx.get("name") == index_name for idx in inspector.get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "admin_skill_tracks"):
        op.create_table(
            "admin_skill_tracks",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("track_type", sa.String(), nullable=False),
            sa.Column("source_kind", sa.String(), nullable=False),
            sa.Column("label", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("created_by_clerk_user_id", sa.String(), nullable=True),
            sa.Column("updated_by_clerk_user_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_admin_skill_tracks_track_type", "admin_skill_tracks", ["track_type"], unique=False)

    if not _table_exists(bind, "admin_question_overrides"):
        op.create_table(
            "admin_question_overrides",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("builtin_question_id", sa.String(), nullable=False),
            sa.Column("override_text", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=True),
            sa.Column("updated_by_clerk_user_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("builtin_question_id", name="uq_admin_question_overrides_builtin_question_id"),
        )
        op.create_index(
            "ix_admin_question_overrides_builtin_question_id",
            "admin_question_overrides",
            ["builtin_question_id"],
            unique=False,
        )

    if not _table_exists(bind, "admin_custom_questions"):
        op.create_table(
            "admin_custom_questions",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("track_id", sa.String(), nullable=False),
            sa.Column("track_type", sa.String(), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("difficulty_scope", sa.String(), nullable=False, server_default="all"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("sort_order", sa.Integer(), nullable=True),
            sa.Column("created_by_clerk_user_id", sa.String(), nullable=True),
            sa.Column("updated_by_clerk_user_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_admin_custom_questions_track_id", "admin_custom_questions", ["track_id"], unique=False)
        op.create_index("ix_admin_custom_questions_track_type", "admin_custom_questions", ["track_type"], unique=False)

    # Backfill helpful indexes if a tool created tables before migrations.
    if _table_exists(bind, "admin_skill_tracks") and not _index_exists(bind, "admin_skill_tracks", "ix_admin_skill_tracks_track_type"):
        op.create_index("ix_admin_skill_tracks_track_type", "admin_skill_tracks", ["track_type"], unique=False)
    if _table_exists(bind, "admin_question_overrides") and not _index_exists(bind, "admin_question_overrides", "ix_admin_question_overrides_builtin_question_id"):
        op.create_index("ix_admin_question_overrides_builtin_question_id", "admin_question_overrides", ["builtin_question_id"], unique=False)
    if _table_exists(bind, "admin_custom_questions") and not _index_exists(bind, "admin_custom_questions", "ix_admin_custom_questions_track_id"):
        op.create_index("ix_admin_custom_questions_track_id", "admin_custom_questions", ["track_id"], unique=False)
    if _table_exists(bind, "admin_custom_questions") and not _index_exists(bind, "admin_custom_questions", "ix_admin_custom_questions_track_type"):
        op.create_index("ix_admin_custom_questions_track_type", "admin_custom_questions", ["track_type"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()

    for table_name, index_name in [
        ("admin_custom_questions", "ix_admin_custom_questions_track_type"),
        ("admin_custom_questions", "ix_admin_custom_questions_track_id"),
        ("admin_question_overrides", "ix_admin_question_overrides_builtin_question_id"),
        ("admin_skill_tracks", "ix_admin_skill_tracks_track_type"),
    ]:
        if _index_exists(bind, table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    for table_name in ["admin_custom_questions", "admin_question_overrides", "admin_skill_tracks"]:
        if _table_exists(bind, table_name):
            op.drop_table(table_name)

