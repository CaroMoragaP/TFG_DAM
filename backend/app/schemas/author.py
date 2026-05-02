from __future__ import annotations

from pydantic import BaseModel


class PrimaryAuthorOut(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    display_name: str
