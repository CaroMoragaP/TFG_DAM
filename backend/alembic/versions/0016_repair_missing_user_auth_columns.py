"""Repair missing auth columns in legacy users tables.

Revision ID: 0016_repair_user_auth_columns
Revises: 0015_unify_review_copy_ratings
Create Date: 2026-05-13 00:20:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0016_repair_user_auth_columns"
down_revision: Union[str, None] = "0015_unify_review_copy_ratings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("users"):
        return

    column_names = {column["name"] for column in inspector.get_columns("users")}
    missing_columns = {
        "is_superuser": sa.Column(
            "is_superuser",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        "is_active": sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        "created_at": sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    }

    columns_to_add = [
        column
        for name, column in missing_columns.items()
        if name not in column_names
    ]
    if not columns_to_add:
        return

    with op.batch_alter_table("users") as batch_op:
        for column in columns_to_add:
            batch_op.add_column(column)


def downgrade() -> None:
    # This migration only repairs drifted legacy databases.
    # Downgrading should not remove live auth data.
    pass
