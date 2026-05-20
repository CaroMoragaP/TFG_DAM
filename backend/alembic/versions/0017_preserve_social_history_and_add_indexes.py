"""Preserve social history when users are deleted and add missing indexes.

Revision ID: 0017_preserve_social_history
Revises: 0016_repair_user_auth_columns
Create Date: 2026-05-20 00:00:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0017_preserve_social_history"
down_revision: Union[str, None] = "0016_repair_user_auth_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.add_column(
        "copy_loans",
        sa.Column("lender_name_snapshot", sa.String(length=120), nullable=True),
    )
    op.execute(
        """
        UPDATE copy_loans
        SET lender_name_snapshot = (
            SELECT users.name
            FROM users
            WHERE users.id = copy_loans.lender_user_id
        )
        """,
    )

    if dialect == "sqlite":
        op.execute(
            """
            UPDATE library_events
            SET payload_json = json_set(
                COALESCE(payload_json, '{}'),
                '$.actor_name',
                (
                    SELECT users.name
                    FROM users
                    WHERE users.id = library_events.actor_user_id
                )
            )
            """,
        )
        _upgrade_sqlite()
    else:
        op.execute(
            """
            UPDATE library_events
            SET payload_json = jsonb_set(
                COALESCE(payload_json::jsonb, '{}'::jsonb),
                '{actor_name}',
                to_jsonb(users.name),
                true
            )
            FROM users
            WHERE users.id = library_events.actor_user_id
            """,
        )
        _upgrade_postgresql_like()

    op.create_index(op.f("ix_libraries_archived_at"), "libraries", ["archived_at"], unique=False)
    op.create_index(op.f("ix_books_genre"), "books", ["genre"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.drop_index(op.f("ix_books_genre"), table_name="books")
    op.drop_index(op.f("ix_libraries_archived_at"), table_name="libraries")

    if dialect == "sqlite":
        _downgrade_sqlite()
    else:
        _downgrade_postgresql_like()

    op.drop_column("copy_loans", "lender_name_snapshot")


def _upgrade_postgresql_like() -> None:
    op.alter_column("copy_loans", "lender_name_snapshot", existing_type=sa.String(length=120), nullable=False)
    op.drop_constraint("copy_loans_lender_user_id_fkey", "copy_loans", type_="foreignkey")
    op.alter_column("copy_loans", "lender_user_id", existing_type=sa.Integer(), nullable=True)
    op.create_foreign_key(
        "copy_loans_lender_user_id_fkey",
        "copy_loans",
        "users",
        ["lender_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_constraint("library_events_actor_user_id_fkey", "library_events", type_="foreignkey")
    op.alter_column("library_events", "actor_user_id", existing_type=sa.Integer(), nullable=True)
    op.create_foreign_key(
        "library_events_actor_user_id_fkey",
        "library_events",
        "users",
        ["actor_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def _downgrade_postgresql_like() -> None:
    op.drop_constraint("library_events_actor_user_id_fkey", "library_events", type_="foreignkey")
    op.alter_column("library_events", "actor_user_id", existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key(
        "library_events_actor_user_id_fkey",
        "library_events",
        "users",
        ["actor_user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("copy_loans_lender_user_id_fkey", "copy_loans", type_="foreignkey")
    op.alter_column("copy_loans", "lender_user_id", existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key(
        "copy_loans_lender_user_id_fkey",
        "copy_loans",
        "users",
        ["lender_user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def _upgrade_sqlite() -> None:
    op.create_table(
        "library_events__stage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("library_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("copy_id", sa.Integer(), nullable=True),
        sa.Column("review_id", sa.Integer(), nullable=True),
        sa.Column("loan_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO library_events__stage (
            id,
            library_id,
            actor_user_id,
            copy_id,
            review_id,
            loan_id,
            event_type,
            created_at,
            payload_json
        )
        SELECT
            id,
            library_id,
            actor_user_id,
            copy_id,
            review_id,
            loan_id,
            event_type,
            created_at,
            payload_json
        FROM library_events
        """,
    )

    op.drop_index("ix_library_events_library_id", table_name="library_events")
    op.drop_table("library_events")

    op.create_table(
        "copy_loans__tmp",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("copy_id", sa.Integer(), nullable=False),
        sa.Column("lender_user_id", sa.Integer(), nullable=True),
        sa.Column("lender_name_snapshot", sa.String(length=120), nullable=False),
        sa.Column("borrower_user_id", sa.Integer(), nullable=True),
        sa.Column("borrower_name", sa.String(length=120), nullable=True),
        sa.Column("loaned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "borrower_user_id IS NOT NULL OR borrower_name IS NOT NULL",
            name="ck_copy_loans_borrower_required",
        ),
        sa.ForeignKeyConstraint(["borrower_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["copy_id"], ["copies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lender_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO copy_loans__tmp (
            id,
            copy_id,
            lender_user_id,
            lender_name_snapshot,
            borrower_user_id,
            borrower_name,
            loaned_at,
            due_date,
            returned_at,
            notes
        )
        SELECT
            id,
            copy_id,
            lender_user_id,
            lender_name_snapshot,
            borrower_user_id,
            borrower_name,
            loaned_at,
            due_date,
            returned_at,
            notes
        FROM copy_loans
        """,
    )
    op.drop_index("uq_copy_loans_active_copy", table_name="copy_loans")
    op.drop_table("copy_loans")
    op.rename_table("copy_loans__tmp", "copy_loans")
    op.create_index(
        "uq_copy_loans_active_copy",
        "copy_loans",
        ["copy_id"],
        unique=True,
        sqlite_where=sa.text("returned_at IS NULL"),
        postgresql_where=sa.text("returned_at IS NULL"),
    )

    op.create_table(
        "library_events__tmp",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("library_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("copy_id", sa.Integer(), nullable=True),
        sa.Column("review_id", sa.Integer(), nullable=True),
        sa.Column("loan_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["copy_id"], ["copies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["library_id"], ["libraries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["loan_id"], ["copy_loans.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO library_events__tmp (
            id,
            library_id,
            actor_user_id,
            copy_id,
            review_id,
            loan_id,
            event_type,
            created_at,
            payload_json
        )
        SELECT
            id,
            library_id,
            actor_user_id,
            copy_id,
            review_id,
            loan_id,
            event_type,
            created_at,
            payload_json
        FROM library_events__stage
        """,
    )
    op.drop_table("library_events__stage")
    op.rename_table("library_events__tmp", "library_events")
    op.create_index("ix_library_events_library_id", "library_events", ["library_id"], unique=False)


def _downgrade_sqlite() -> None:
    op.create_table(
        "library_events__stage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("library_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=False),
        sa.Column("copy_id", sa.Integer(), nullable=True),
        sa.Column("review_id", sa.Integer(), nullable=True),
        sa.Column("loan_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO library_events__stage (
            id,
            library_id,
            actor_user_id,
            copy_id,
            review_id,
            loan_id,
            event_type,
            created_at,
            payload_json
        )
        SELECT
            id,
            library_id,
            actor_user_id,
            copy_id,
            review_id,
            loan_id,
            event_type,
            created_at,
            payload_json
        FROM library_events
        """,
    )

    op.drop_index("ix_library_events_library_id", table_name="library_events")
    op.drop_table("library_events")

    op.create_table(
        "copy_loans__tmp",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("copy_id", sa.Integer(), nullable=False),
        sa.Column("lender_user_id", sa.Integer(), nullable=False),
        sa.Column("borrower_user_id", sa.Integer(), nullable=True),
        sa.Column("borrower_name", sa.String(length=120), nullable=True),
        sa.Column("loaned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "borrower_user_id IS NOT NULL OR borrower_name IS NOT NULL",
            name="ck_copy_loans_borrower_required",
        ),
        sa.ForeignKeyConstraint(["borrower_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["copy_id"], ["copies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["lender_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO copy_loans__tmp (
            id,
            copy_id,
            lender_user_id,
            borrower_user_id,
            borrower_name,
            loaned_at,
            due_date,
            returned_at,
            notes
        )
        SELECT
            id,
            copy_id,
            lender_user_id,
            borrower_user_id,
            borrower_name,
            loaned_at,
            due_date,
            returned_at,
            notes
        FROM copy_loans
        """,
    )
    op.drop_index("uq_copy_loans_active_copy", table_name="copy_loans")
    op.drop_table("copy_loans")
    op.rename_table("copy_loans__tmp", "copy_loans")
    op.create_index(
        "uq_copy_loans_active_copy",
        "copy_loans",
        ["copy_id"],
        unique=True,
        sqlite_where=sa.text("returned_at IS NULL"),
        postgresql_where=sa.text("returned_at IS NULL"),
    )

    op.create_table(
        "library_events__tmp",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("library_id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=False),
        sa.Column("copy_id", sa.Integer(), nullable=True),
        sa.Column("review_id", sa.Integer(), nullable=True),
        sa.Column("loan_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["copy_id"], ["copies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["library_id"], ["libraries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["loan_id"], ["copy_loans.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO library_events__tmp (
            id,
            library_id,
            actor_user_id,
            copy_id,
            review_id,
            loan_id,
            event_type,
            created_at,
            payload_json
        )
        SELECT
            id,
            library_id,
            actor_user_id,
            copy_id,
            review_id,
            loan_id,
            event_type,
            created_at,
            payload_json
        FROM library_events__stage
        """,
    )
    op.drop_table("library_events__stage")
    op.rename_table("library_events__tmp", "library_events")
    op.create_index("ix_library_events_library_id", "library_events", ["library_id"], unique=False)
