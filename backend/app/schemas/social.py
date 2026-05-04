from __future__ import annotations

from datetime import date
from datetime import datetime
from typing import Literal

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import model_validator
from pydantic import field_validator

from app.models.enums import LibraryEventType


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


class ReaderPreviewOut(BaseModel):
    user_id: int
    name: str


class CopyLoanCreate(BaseModel):
    borrower_user_id: int | None = None
    borrower_name: str | None = Field(default=None, max_length=120)
    due_date: date | None = None
    notes: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("borrower_name", "notes")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @model_validator(mode="after")
    def validate_borrower(self) -> "CopyLoanCreate":
        if self.borrower_user_id is None and self.borrower_name is None:
            raise ValueError("Debes indicar borrower_user_id o borrower_name.")
        return self


class CopyLoanOut(BaseModel):
    id: int
    copy_id: int
    lender_user_id: int
    lender_name: str
    borrower_user_id: int | None
    borrower_name: str
    is_internal: bool
    loaned_at: datetime
    due_date: date | None
    returned_at: datetime | None
    notes: str | None

    model_config = ConfigDict(from_attributes=True)


class ReviewCreate(BaseModel):
    body: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)


class ReviewUpdate(BaseModel):
    body: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @model_validator(mode="after")
    def validate_update(self) -> "ReviewUpdate":
        if not self.model_fields_set:
            raise ValueError("Debes enviar al menos un campo para actualizar.")
        return self


class ReviewOut(BaseModel):
    id: int
    copy_id: int
    user_id: int
    user_name: str
    rating: int
    body: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CopyCommunityOut(BaseModel):
    copy_id: int
    active_loan: CopyLoanOut | None
    shared_readers: list[ReaderPreviewOut]
    shared_readers_count: int
    public_review_count: int
    public_average_rating: float | None
    latest_reviews: list[ReviewOut]


class LibraryReviewCardOut(BaseModel):
    copy_id: int
    book_id: int
    title: str
    authors: list[str]
    cover_url: str | None
    public_review_count: int
    public_average_rating: float | None
    last_reviewed_at: datetime
    my_review: ReviewOut | None
    other_reviews: list[ReviewOut]


class LibraryReviewsPageOut(BaseModel):
    items: list[LibraryReviewCardOut]
    total: int
    limit: int
    offset: int


LibraryReviewFilter = Literal["all", "missing_mine", "mine"]
LibraryReviewSort = Literal["recent", "rating", "count"]


class LibraryEventOut(BaseModel):
    id: int
    library_id: int
    actor_user_id: int
    actor_name: str
    copy_id: int | None
    review_id: int | None
    loan_id: int | None
    event_type: LibraryEventType
    created_at: datetime
    payload_json: dict[str, object]

    model_config = ConfigDict(from_attributes=True)


class LibraryActivityPageOut(BaseModel):
    items: list[LibraryEventOut]
    total: int
    limit: int
    offset: int
