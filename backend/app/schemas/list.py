from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import field_validator

from app.models.enums import ListType


class _ListNameMixin(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("El nombre es obligatorio.")
        return normalized


class ListCreate(_ListNameMixin):
    type: ListType = ListType.CUSTOM


class ListUpdate(_ListNameMixin):
    type: ListType = ListType.CUSTOM


class ListOut(BaseModel):
    id: int
    user_id: int
    name: str
    type: ListType
    created_at: datetime
    updated_at: datetime
    book_count: int

    model_config = ConfigDict(from_attributes=True)


class ListBookCreate(BaseModel):
    book_id: int = Field(gt=0)


class ListBookSummary(BaseModel):
    book_id: int
    title: str
    authors: list[str]
    genre: str | None
    themes: list[str]
    collection: str | None
    author_country: str | None
    cover_url: str | None
    publication_year: int | None
    isbn: str | None
    added_at: datetime


class DefaultListSeed(BaseModel):
    name: str
    type: ListType
