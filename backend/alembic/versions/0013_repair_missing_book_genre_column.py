"""Repair missing books.genre column in legacy databases.

Revision ID: 0013_repair_book_genre
Revises: 0012_repair_missing_theme_tables
Create Date: 2026-05-02 23:10:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0013_repair_book_genre"
down_revision: Union[str, None] = "0012_repair_missing_theme_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("books"):
        return

    column_names = {column["name"] for column in inspector.get_columns("books")}
    if "genre" in column_names:
        return

    with op.batch_alter_table("books") as batch_op:
        batch_op.add_column(sa.Column("genre", sa.String(length=32), nullable=True))


def downgrade() -> None:
    # This migration only repairs drifted legacy databases.
    # Downgrading should not remove live catalog data.
    pass
