"""Add reading status and user rating to copies.

Revision ID: 0004_add_catalog_reading_fields
Revises: 0003_create_libraries_and_books
Create Date: 2026-04-19 00:00:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_add_catalog_reading_fields"
down_revision: Union[str, None] = "0003_create_libraries_and_books"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


reading_status = sa.Enum(
    "pending",
    "reading",
    "finished",
    name="reading_status",
    native_enum=False,
)


def upgrade() -> None:
    reading_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "copies",
        sa.Column(
            "reading_status",
            reading_status,
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "copies",
        sa.Column("user_rating", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_copies_user_rating_range",
        "copies",
        "user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5)",
    )
    op.alter_column("copies", "reading_status", server_default=None)


def downgrade() -> None:
    op.drop_constraint("ck_copies_user_rating_range", "copies", type_="check")
    op.drop_column("copies", "user_rating")
    op.drop_column("copies", "reading_status")
    reading_status.drop(op.get_bind(), checkfirst=True)
