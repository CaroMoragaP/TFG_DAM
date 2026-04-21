from __future__ import annotations

from pydantic import BaseModel


class ExternalBookLookupOut(BaseModel):
    title: str
    authors: list[str]
    publication_year: int | None = None
    isbn: str | None = None
    genres: list[str]
    cover_url: str | None = None
    publisher_name: str | None = None
