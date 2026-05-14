"""Create user_copies for per-user reading state.

Revision ID: 0007_create_user_copies
Revises: 0005_create_lists
Create Date: 2026-04-25 00:00:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007_create_user_copies"
down_revision: Union[str, None] = "0005_create_lists"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_copies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("copy_id", sa.Integer(), nullable=False),
        sa.Column("reading_status", sa.String(length=8), nullable=False, server_default="pending"),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("personal_notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["copy_id"], ["copies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "copy_id", name="uq_user_copies_user_id_copy_id"),
        sa.CheckConstraint(
            "rating IS NULL OR (rating >= 1 AND rating <= 5)",
            name="ck_user_copies_rating_range",
        ),
    )


def downgrade() -> None:
    op.drop_table("user_copies")
