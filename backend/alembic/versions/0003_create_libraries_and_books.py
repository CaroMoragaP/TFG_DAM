"""Create the consolidated libraries and catalog schema.

Revision ID: 0003_create_libraries_and_books
Revises: 0002_create_users
Create Date: 2026-04-18 02:20:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_create_libraries_and_books"
down_revision: Union[str, None] = "0002_create_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


THEME_LABELS: tuple[str, ...] = (
    "Fantas\u00eda",
    "Ficci\u00f3n hist\u00f3rica",
    "Terror",
    "Humor",
    "Literatura",
    "Magia",
    "Misterio e historias de detectives",
    "Obras de teatro",
    "Poes\u00eda",
    "Rom\u00e1ntica",
    "Ciencia ficci\u00f3n",
    "Historias cortas",
    "Suspense",
    "Juvenil",
    "Infantil",
    "Historia",
    "Biograf\u00eda",
    "Ciencias sociales",
    "Salud y bienestar",
    "Artes",
    "Ciencia y matem\u00e1ticas",
    "Negocios y finanzas",
    "Idiomas",
)

BOOK_GENRE_CHECK = (
    "genre IS NULL OR genre IN ('narrativo', 'l\u00c3\u00adrico', "
    "'dram\u00c3\u00a1tico', 'did\u00c3\u00a1ctico')"
)


def upgrade() -> None:
    op.create_table(
        "libraries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=8), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

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

    op.create_table(
        "publishers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_publishers_name"),
    )

    op.create_table(
        "authors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(length=255), nullable=True),
        sa.Column("last_name", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("country_id", sa.Integer(), nullable=True),
        sa.Column("sex", sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(["country_id"], ["countries.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("display_name", name="uq_authors_display_name"),
    )

    op.create_table(
        "themes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_themes_name"),
    )
    theme_table = sa.table("themes", sa.column("name", sa.String(length=120)))
    op.bulk_insert(theme_table, [{"name": label} for label in THEME_LABELS])

    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("isbn", sa.String(length=32), nullable=True),
        sa.Column("publication_year", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cover_url", sa.String(length=500), nullable=True),
        sa.Column("publisher_id", sa.Integer(), nullable=True),
        sa.Column("collection_id", sa.Integer(), nullable=True),
        sa.Column("genre", sa.String(length=32), nullable=True),
        sa.CheckConstraint(BOOK_GENRE_CHECK, name="ck_books_genre_allowed_values"),
        sa.ForeignKeyConstraint(["collection_id"], ["collections.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["publisher_id"], ["publishers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("isbn", name="uq_books_isbn"),
    )
    op.create_index(op.f("ix_books_title"), "books", ["title"], unique=False)

    op.create_table(
        "user_libraries",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("library_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=6), nullable=False),
        sa.ForeignKeyConstraint(["library_id"], ["libraries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "library_id"),
        sa.UniqueConstraint(
            "user_id",
            "library_id",
            name="uq_user_libraries_user_id_library_id",
        ),
    )
    op.create_index(
        op.f("ix_user_libraries_library_id"),
        "user_libraries",
        ["library_id"],
        unique=False,
    )

    op.create_table(
        "book_authors",
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["authors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("book_id", "author_id"),
        sa.UniqueConstraint(
            "book_id",
            "author_id",
            name="uq_book_authors_book_id_author_id",
        ),
    )
    op.create_index(
        op.f("ix_book_authors_author_id"),
        "book_authors",
        ["author_id"],
        unique=False,
    )

    op.create_table(
        "book_themes",
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("theme_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["theme_id"], ["themes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("book_id", "theme_id"),
        sa.UniqueConstraint(
            "book_id",
            "theme_id",
            name="uq_book_themes_book_id_theme_id",
        ),
    )
    op.create_index(
        op.f("ix_book_themes_theme_id"),
        "book_themes",
        ["theme_id"],
        unique=False,
    )

    op.create_table(
        "copies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.Column("library_id", sa.Integer(), nullable=False),
        sa.Column("format", sa.String(length=8), nullable=False),
        sa.Column("physical_location", sa.String(length=255), nullable=True),
        sa.Column("digital_location", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=9), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["library_id"], ["libraries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("book_id", "library_id", name="uq_copies_book_id_library_id"),
    )
    op.create_index(op.f("ix_copies_book_id"), "copies", ["book_id"], unique=False)
    op.create_index(op.f("ix_copies_library_id"), "copies", ["library_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_copies_library_id"), table_name="copies")
    op.drop_index(op.f("ix_copies_book_id"), table_name="copies")
    op.drop_table("copies")

    op.drop_index(op.f("ix_book_themes_theme_id"), table_name="book_themes")
    op.drop_table("book_themes")

    op.drop_index(op.f("ix_book_authors_author_id"), table_name="book_authors")
    op.drop_table("book_authors")

    op.drop_index(op.f("ix_user_libraries_library_id"), table_name="user_libraries")
    op.drop_table("user_libraries")

    op.drop_index(op.f("ix_books_title"), table_name="books")
    op.drop_table("books")

    op.drop_table("themes")
    op.drop_table("authors")
    op.drop_table("publishers")
    op.drop_table("collections")
    op.drop_table("countries")
    op.drop_table("libraries")
