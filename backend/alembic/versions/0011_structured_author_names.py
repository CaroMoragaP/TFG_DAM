"""Restructure author names into first/last/display fields.

Revision ID: 0011_structured_author_names
Revises: 0010_create_reading_goals
Create Date: 2026-05-02 18:30:00
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0011_structured_author_names"
down_revision: Union[str, None] = "0010_create_reading_goals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("authors") as batch_op:
        batch_op.add_column(sa.Column("first_name", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("last_name", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("display_name", sa.String(length=255), nullable=True))

    connection = op.get_bind()
    authors = list(connection.execute(sa.text("SELECT id, name FROM authors")))
    for author_id, legacy_name in authors:
        first_name, last_name, display_name = _split_legacy_name(legacy_name)
        connection.execute(
            sa.text(
                """
                UPDATE authors
                SET first_name = :first_name,
                    last_name = :last_name,
                    display_name = :display_name
                WHERE id = :author_id
                """
            ),
            {
                "author_id": author_id,
                "first_name": first_name,
                "last_name": last_name,
                "display_name": display_name,
            },
        )

    with op.batch_alter_table("authors") as batch_op:
        batch_op.alter_column("display_name", existing_type=sa.String(length=255), nullable=False)
        batch_op.create_unique_constraint("uq_authors_display_name", ["display_name"])
        batch_op.drop_constraint("uq_authors_name", type_="unique")
        batch_op.drop_column("name")


def downgrade() -> None:
    with op.batch_alter_table("authors") as batch_op:
        batch_op.add_column(sa.Column("name", sa.String(length=255), nullable=True))

    connection = op.get_bind()
    connection.execute(sa.text("UPDATE authors SET name = display_name"))

    with op.batch_alter_table("authors") as batch_op:
        batch_op.alter_column("name", existing_type=sa.String(length=255), nullable=False)
        batch_op.create_unique_constraint("uq_authors_name", ["name"])
        batch_op.drop_constraint("uq_authors_display_name", type_="unique")
        batch_op.drop_column("display_name")
        batch_op.drop_column("last_name")
        batch_op.drop_column("first_name")


def _split_legacy_name(value: str | None) -> tuple[str | None, str | None, str]:
    display_name = (value or "").strip()
    if not display_name:
        return None, None, "Autor sin registrar"

    if "," in display_name:
        last_name, first_name = [part.strip() for part in display_name.split(",", 1)]
        return first_name or None, last_name or None, display_name

    parts = display_name.split()
    if len(parts) == 2:
        return parts[0], parts[1], display_name

    return None, None, display_name
