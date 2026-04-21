"""Initial empty baseline migration.

Revision ID: 0001_initial_baseline
Revises:
Create Date: 2026-04-18 00:00:00
"""
from __future__ import annotations

from typing import Sequence
from typing import Union


revision: str = "0001_initial_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

