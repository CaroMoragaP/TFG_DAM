from __future__ import annotations

from pydantic import BaseModel
from pydantic import Field

from app.models.enums import CopyFormat
from app.models.enums import CopyStatus
from app.models.enums import ReadingStatus


class CatalogImportRowPayload(BaseModel):
    title: str
    isbn: str | None = None
    publication_year: int | None = None
    description: str | None = None
    cover_url: str | None = None
    publisher_name: str | None = None
    collection_name: str | None = None
    author_country_name: str | None = None
    author_sex: str | None = None
    primary_author_first_name: str | None = None
    primary_author_last_name: str | None = None
    primary_author_display_name: str | None = None
    authors: list[str] = Field(default_factory=list)
    genres: list[str] = Field(default_factory=list)
    format: CopyFormat = CopyFormat.PHYSICAL
    physical_location: str | None = None
    digital_location: str | None = None
    status: CopyStatus = CopyStatus.AVAILABLE
    reading_status: ReadingStatus = ReadingStatus.PENDING
    user_rating: int | None = None


class CatalogImportPreviewRowOut(BaseModel):
    row_number: int
    status: str
    messages: list[str]
    normalized_payload: CatalogImportRowPayload | None = None


class CatalogImportPreviewOut(BaseModel):
    total: int
    ready: int
    duplicates: int
    invalid: int
    rows: list[CatalogImportPreviewRowOut]


class CatalogImportCommitIn(BaseModel):
    library_id: int
    rows: list[CatalogImportPreviewRowOut]


class CatalogImportResultRowOut(BaseModel):
    row_number: int
    status: str
    messages: list[str]
    copy_id: int | None = None
    book_id: int | None = None


class CatalogImportCommitOut(BaseModel):
    imported: int
    skipped_duplicates: int
    failed: int
    results: list[CatalogImportResultRowOut]
