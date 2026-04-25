"""Create personal lists tables.

Revision ID: 0005_create_lists
Revises: 0004_add_catalog_reading_fields
Create Date: 2026-04-19 01:00:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_create_lists"
down_revision: Union[str, None] = "0004_add_catalog_reading_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


list_type = sa.Enum(
    "wishlist",
    "pending",
    "custom",
    name="list_type",
    native_enum=False,
)


def upgrade() -> None:
    list_type.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "lists",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("type", list_type, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lists_user_id"), "lists", ["user_id"], unique=False)

    op.create_table(
        "list_books",
        sa.Column("list_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["list_id"], ["lists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("list_id", "book_id"),
        sa.UniqueConstraint("list_id", "book_id", name="uq_list_books_list_id_book_id"),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            INSERT INTO lists (user_id, name, type)
            SELECT id, 'Favoritos', 'wishlist'
            FROM users
            """
        ),
    )
    connection.execute(
        sa.text(
            """
            INSERT INTO lists (user_id, name, type)
            SELECT id, 'Pendientes', 'pending'
            FROM users
            """
        ),
    )


def downgrade() -> None:
    op.drop_table("list_books")
    op.drop_index(op.f("ix_lists_user_id"), table_name="lists")
    op.drop_table("lists")
    list_type.drop(op.get_bind(), checkfirst=True)
