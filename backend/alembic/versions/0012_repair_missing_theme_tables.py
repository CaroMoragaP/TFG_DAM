"""Repair missing theme tables in legacy databases.

Revision ID: 0012_repair_missing_theme_tables
Revises: 0011_structured_author_names
Create Date: 2026-05-02 22:30:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0012_repair_missing_theme_tables"
down_revision: Union[str, None] = "0011_structured_author_names"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


THEME_LABELS: tuple[str, ...] = (
    "Fantasía",
    "Ficción histórica",
    "Terror",
    "Humor",
    "Literatura",
    "Magia",
    "Misterio e historias de detectives",
    "Obras de teatro",
    "Poesía",
    "Romántica",
    "Ciencia ficción",
    "Historias cortas",
    "Suspense",
    "Juvenil",
    "Infantil",
    "Historia",
    "Biografía",
    "Ciencias sociales",
    "Salud y bienestar",
    "Artes",
    "Ciencia y matemáticas",
    "Negocios y finanzas",
    "Idiomas",
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("themes"):
        op.create_table(
            "themes",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name", name="uq_themes_name"),
        )

    inspector = sa.inspect(bind)
    if inspector.has_table("themes"):
        for label in THEME_LABELS:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO themes (name)
                    SELECT CAST(:label AS VARCHAR(120))
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM themes
                        WHERE LOWER(name) = LOWER(CAST(:label AS VARCHAR(120)))
                    )
                    """
                ),
                {"label": label},
            )

    if not inspector.has_table("book_themes"):
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

    inspector = sa.inspect(bind)
    index_names = {index["name"] for index in inspector.get_indexes("book_themes")}
    if "ix_book_themes_theme_id" not in index_names:
        op.create_index(
            op.f("ix_book_themes_theme_id"),
            "book_themes",
            ["theme_id"],
            unique=False,
        )


def downgrade() -> None:
    # This migration only repairs missing tables on drifted databases.
    # Downgrading should not drop live catalog data.
    pass
