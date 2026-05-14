"""Keep the consolidated migration history on the existing head revision.

Revision ID: 0016_repair_user_auth_columns
Revises: 0014_shared_library_community
Create Date: 2026-05-13 00:20:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union


revision: str = "0016_repair_user_auth_columns"
down_revision: Union[str, None] = "0014_shared_library_community"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The auth columns now live directly in the squashed 0002 migration.
    # Keeping the existing head revision avoids forcing a stamp on databases
    # that are already aligned with the previous head.
    pass


def downgrade() -> None:
    pass
