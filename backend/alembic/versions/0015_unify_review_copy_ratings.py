"""Backfill canonical user copy ratings from public reviews.

Revision ID: 0015_unify_review_copy_ratings
Revises: 0014_shared_library_community
Create Date: 2026-05-04 15:30:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0015_unify_review_copy_ratings"
down_revision: Union[str, None] = "0014_shared_library_community"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    connection.execute(
        sa.text(
            """
            INSERT INTO user_copies (user_id, copy_id, reading_status, rating, start_date, end_date, personal_notes)
            SELECT reviews.user_id, reviews.copy_id, 'pending', reviews.rating, NULL, NULL, NULL
            FROM reviews
            LEFT JOIN user_copies
              ON user_copies.user_id = reviews.user_id
             AND user_copies.copy_id = reviews.copy_id
            WHERE user_copies.id IS NULL
            """,
        ),
    )
    connection.execute(
        sa.text(
            """
            UPDATE user_copies
               SET rating = (
                    SELECT reviews.rating
                    FROM reviews
                    WHERE reviews.user_id = user_copies.user_id
                      AND reviews.copy_id = user_copies.copy_id
               )
             WHERE EXISTS (
                    SELECT 1
                    FROM reviews
                    WHERE reviews.user_id = user_copies.user_id
                      AND reviews.copy_id = user_copies.copy_id
               )
            """,
        ),
    )
    connection.execute(
        sa.text(
            """
            UPDATE reviews
               SET rating = (
                    SELECT user_copies.rating
                    FROM user_copies
                    WHERE user_copies.user_id = reviews.user_id
                      AND user_copies.copy_id = reviews.copy_id
               )
             WHERE EXISTS (
                    SELECT 1
                    FROM user_copies
                    WHERE user_copies.user_id = reviews.user_id
                      AND user_copies.copy_id = reviews.copy_id
               )
            """,
        ),
    )


def downgrade() -> None:
    pass
