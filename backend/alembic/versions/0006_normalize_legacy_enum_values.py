"""Normalize legacy uppercase enum values.

Revision ID: 0006_normalize_legacy_enums
Revises: 0005_create_lists
Create Date: 2026-04-20 10:30:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op


revision: str = "0006_normalize_legacy_enums"
down_revision: Union[str, None] = "0005_create_lists"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _rewrite_enum_column(*, table_name: str, column_name: str, sql_function: str) -> None:
    op.execute(
        f'''
        UPDATE "{table_name}"
        SET "{column_name}" = {sql_function}("{column_name}")
        WHERE "{column_name}" != {sql_function}("{column_name}")
        ''',
    )


def upgrade() -> None:
    _rewrite_enum_column(table_name="libraries", column_name="type", sql_function="LOWER")
    _rewrite_enum_column(table_name="user_libraries", column_name="role", sql_function="LOWER")
    _rewrite_enum_column(table_name="copies", column_name="format", sql_function="LOWER")
    _rewrite_enum_column(table_name="copies", column_name="status", sql_function="LOWER")
    _rewrite_enum_column(table_name="copies", column_name="reading_status", sql_function="LOWER")
    _rewrite_enum_column(table_name="lists", column_name="type", sql_function="LOWER")


def downgrade() -> None:
    _rewrite_enum_column(table_name="libraries", column_name="type", sql_function="UPPER")
    _rewrite_enum_column(table_name="user_libraries", column_name="role", sql_function="UPPER")
    _rewrite_enum_column(table_name="copies", column_name="format", sql_function="UPPER")
    _rewrite_enum_column(table_name="copies", column_name="status", sql_function="UPPER")
    _rewrite_enum_column(table_name="copies", column_name="reading_status", sql_function="UPPER")
    _rewrite_enum_column(table_name="lists", column_name="type", sql_function="UPPER")
