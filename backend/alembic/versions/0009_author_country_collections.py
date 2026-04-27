"""Add author countries and book collections.

Revision ID: 0009_author_country_collections
Revises: 0008_library_roles_archiving
Create Date: 2026-04-26 19:00:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0009_author_country_collections"
down_revision: Union[str, None] = "0008_library_roles_archiving"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "countries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_countries_name"),
    )
    op.create_table(
        "collections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_collections_name"),
    )

    with op.batch_alter_table("authors") as batch_op:
        batch_op.add_column(sa.Column("country_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_authors_country_id_countries",
            "countries",
            ["country_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("books") as batch_op:
        batch_op.add_column(sa.Column("collection_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_books_collection_id_collections",
            "collections",
            ["collection_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.execute(
        sa.text(
            """
            INSERT INTO countries (name)
            SELECT MIN(TRIM(country_of_birth))
            FROM authors
            WHERE country_of_birth IS NOT NULL
              AND TRIM(country_of_birth) <> ''
            GROUP BY LOWER(TRIM(country_of_birth))
            """
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE authors
            SET country_id = (
                SELECT c.id
                FROM countries c
                WHERE LOWER(c.name) = LOWER(TRIM(authors.country_of_birth))
            )
            WHERE country_of_birth IS NOT NULL
              AND TRIM(country_of_birth) <> ''
            """
        ),
    )

    with op.batch_alter_table("authors") as batch_op:
        batch_op.drop_column("country_of_birth")


def downgrade() -> None:
    with op.batch_alter_table("authors") as batch_op:
        batch_op.add_column(sa.Column("country_of_birth", sa.String(length=120), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE authors
            SET country_of_birth = (
                SELECT countries.name
                FROM countries
                WHERE countries.id = authors.country_id
            )
            WHERE country_id IS NOT NULL
            """
        ),
    )

    with op.batch_alter_table("books") as batch_op:
        batch_op.drop_constraint("fk_books_collection_id_collections", type_="foreignkey")
        batch_op.drop_column("collection_id")

    with op.batch_alter_table("authors") as batch_op:
        batch_op.drop_constraint("fk_authors_country_id_countries", type_="foreignkey")
        batch_op.drop_column("country_id")

    op.drop_table("collections")
    op.drop_table("countries")
