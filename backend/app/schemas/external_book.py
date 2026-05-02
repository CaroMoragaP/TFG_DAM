from __future__ import annotations

from pydantic import BaseModel

from app.schemas.author import PrimaryAuthorOut


class ExternalBookLookupOut(BaseModel):
    title: str
    authors: list[str]
    primary_author: PrimaryAuthorOut | None = None
    publication_year: int | None = None
    isbn: str | None = None
    themes: list[str]
    cover_url: str | None = None
    publisher_name: str | None = None
