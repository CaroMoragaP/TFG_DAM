"""Create user_copies and move personal reading data.

Revision ID: 0007_create_user_copies
Revises: 0006_normalize_legacy_enums
Create Date: 2026-04-25 00:00:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0007_create_user_copies"
down_revision: Union[str, None] = "0006_normalize_legacy_enums"
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

    op.execute(
        sa.text(
            """
            INSERT INTO user_copies (
                user_id,
                copy_id,
                reading_status,
                rating,
                start_date,
                end_date,
                personal_notes
            )
            SELECT
                ul.user_id,
                c.id,
                c.reading_status,
                c.user_rating,
                NULL,
                NULL,
                NULL
            FROM copies c
            JOIN user_libraries ul ON ul.library_id = c.library_id
            """
        ),
    )

    op.drop_constraint("ck_copies_user_rating_range", "copies", type_="check")
    op.drop_column("copies", "user_rating")
    op.drop_column("copies", "reading_status")


def downgrade() -> None:
    op.add_column(
        "copies",
        sa.Column("reading_status", sa.String(length=8), nullable=False, server_default="pending"),
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

    op.execute(
        sa.text(
            """
            UPDATE copies
            SET
                reading_status = COALESCE(
                    (
                        SELECT uc.reading_status
                        FROM user_copies uc
                        JOIN user_libraries ul
                            ON ul.user_id = uc.user_id
                           AND ul.library_id = copies.library_id
                        WHERE uc.copy_id = copies.id
                          AND ul.role = 'owner'
                        LIMIT 1
                    ),
                    (
                        SELECT uc.reading_status
                        FROM user_copies uc
                        WHERE uc.copy_id = copies.id
                        LIMIT 1
                    ),
                    'pending'
                ),
                user_rating = COALESCE(
                    (
                        SELECT uc.rating
                        FROM user_copies uc
                        JOIN user_libraries ul
                            ON ul.user_id = uc.user_id
                           AND ul.library_id = copies.library_id
                        WHERE uc.copy_id = copies.id
                          AND ul.role = 'owner'
                        LIMIT 1
                    ),
                    (
                        SELECT uc.rating
                        FROM user_copies uc
                        WHERE uc.copy_id = copies.id
                        LIMIT 1
                    )
                )
            """
        ),
    )

    op.alter_column("copies", "reading_status", server_default=None)
    op.drop_table("user_copies")
