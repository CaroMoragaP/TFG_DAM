"""Add shared library community MVP tables.

Revision ID: 0014_shared_library_community
Revises: 0013_repair_book_genre
Create Date: 2026-05-04 12:00:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0014_shared_library_community"
down_revision: Union[str, None] = "0013_repair_book_genre"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "copy_loans",
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
    op.create_index(
        "uq_copy_loans_active_copy",
        "copy_loans",
        ["copy_id"],
        unique=True,
        sqlite_where=sa.text("returned_at IS NULL"),
        postgresql_where=sa.text("returned_at IS NULL"),
    )

    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("copy_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
        sa.ForeignKeyConstraint(["copy_id"], ["copies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "copy_id", name="uq_reviews_user_id_copy_id"),
    )

    op.create_table(
        "library_events",
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
    op.create_index("ix_library_events_library_id", "library_events", ["library_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_library_events_library_id", table_name="library_events")
    op.drop_table("library_events")
    op.drop_table("reviews")
    op.drop_index("uq_copy_loans_active_copy", table_name="copy_loans")
    op.drop_table("copy_loans")
