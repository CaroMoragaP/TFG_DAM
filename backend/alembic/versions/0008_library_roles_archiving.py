"""Add shared library archiving and expanded roles.

Revision ID: 0008_library_roles_archiving
Revises: 0007_create_user_copies
Create Date: 2026-04-25 22:15:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


revision: str = "0008_library_roles_archiving"
down_revision: Union[str, None] = "0007_create_user_copies"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("libraries", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE user_libraries SET role = 'editor' WHERE LOWER(role) = 'member'")


def downgrade() -> None:
    op.execute("UPDATE user_libraries SET role = 'member' WHERE LOWER(role) = 'editor'")
    op.drop_column("libraries", "archived_at")
