from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from app.models.enums import ReadingStatus
from app.schemas.social import ReviewOut


class ReadingShelfItemOut(BaseModel):
    copy_id: int
    book_id: int
    library_id: int
    title: str
    authors: list[str]
    cover_url: str | None
    genre: str | None
    collection: str | None
    author_country: str | None
    reading_status: ReadingStatus
    rating: int | None
    start_date: date | None
    end_date: date | None
    personal_notes: str | None
    public_review_count: int = 0
    public_average_rating: float | None = None
    my_public_review: ReviewOut | None = None
