from __future__ import annotations

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import field_validator

from app.core.author_names import build_structured_author_name
from app.core.book_fields import normalize_author_sex
from app.core.book_fields import normalize_literary_genre
from app.core.themes import normalize_theme_list
from app.models.enums import CopyFormat
from app.models.enums import CopyStatus
from app.models.enums import ReadingStatus
from app.schemas.author import PrimaryAuthorOut
from app.schemas.social import CopyLoanOut
from app.schemas.social import ReaderPreviewOut


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


def _normalize_name_list(values: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized_values: list[str] = []

    for value in values:
        normalized = value.strip()
        if not normalized:
            continue

        key = normalized.casefold()
        if key in seen:
            continue

        seen.add(key)
        normalized_values.append(normalized)

    return normalized_values


class BookCreate(BaseModel):
    library_id: int
    title: str = Field(min_length=1, max_length=255)
    isbn: str | None = Field(default=None, max_length=32)
    publication_year: int | None = Field(default=None, ge=0, le=9999)
    description: str | None = None
    cover_url: str | None = Field(default=None, max_length=500)
    publisher_name: str | None = Field(default=None, max_length=255)
    collection_name: str | None = Field(default=None, max_length=255)
    author_country_name: str | None = Field(default=None, max_length=120)
    author_sex: str | None = Field(default=None, max_length=50)
    primary_author_first_name: str | None = Field(default=None, max_length=255)
    primary_author_last_name: str | None = Field(default=None, max_length=255)
    primary_author_display_name: str | None = Field(default=None, max_length=255)
    authors: list[str] = Field(default_factory=list)
    genre: str | None = Field(default=None, max_length=32)
    themes: list[str] = Field(default_factory=list)
    format: CopyFormat = CopyFormat.PHYSICAL
    physical_location: str | None = Field(default=None, max_length=255)
    digital_location: str | None = Field(default=None, max_length=500)
    status: CopyStatus = CopyStatus.AVAILABLE
    reading_status: ReadingStatus = ReadingStatus.PENDING
    user_rating: int | None = Field(default=None, ge=1, le=5)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("El titulo es obligatorio.")
        return normalized

    @field_validator(
        "isbn",
        "description",
        "cover_url",
        "publisher_name",
        "collection_name",
        "author_country_name",
        "author_sex",
        "primary_author_first_name",
        "primary_author_last_name",
        "primary_author_display_name",
        "physical_location",
        "digital_location",
    )
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @field_validator("author_sex")
    @classmethod
    def normalize_author_sex_value(cls, value: str | None) -> str | None:
        return normalize_author_sex(value)

    @field_validator("genre")
    @classmethod
    def normalize_genre_value(cls, value: str | None) -> str | None:
        return normalize_literary_genre(value)

    @field_validator("authors")
    @classmethod
    def normalize_collections(cls, value: list[str]) -> list[str]:
        return _normalize_name_list(value)

    @field_validator("themes")
    @classmethod
    def normalize_theme_values(cls, value: list[str]) -> list[str]:
        return normalize_theme_list(value)

    @field_validator("primary_author_display_name")
    @classmethod
    def normalize_primary_author_display_name(cls, value: str | None, info) -> str | None:
        if value is not None:
            return value

        first_name = info.data.get("primary_author_first_name")
        last_name = info.data.get("primary_author_last_name")
        return build_structured_author_name(
            first_name=first_name,
            last_name=last_name,
        ).display_name


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    isbn: str | None = Field(default=None, max_length=32)
    publication_year: int | None = Field(default=None, ge=0, le=9999)
    description: str | None = None
    cover_url: str | None = Field(default=None, max_length=500)
    publisher_name: str | None = Field(default=None, max_length=255)
    collection_name: str | None = Field(default=None, max_length=255)
    author_country_name: str | None = Field(default=None, max_length=120)
    author_sex: str | None = Field(default=None, max_length=50)
    primary_author_first_name: str | None = Field(default=None, max_length=255)
    primary_author_last_name: str | None = Field(default=None, max_length=255)
    primary_author_display_name: str | None = Field(default=None, max_length=255)
    authors: list[str] | None = None
    genre: str | None = Field(default=None, max_length=32)
    themes: list[str] | None = None
    format: CopyFormat | None = None
    physical_location: str | None = Field(default=None, max_length=255)
    digital_location: str | None = Field(default=None, max_length=500)
    status: CopyStatus | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("El titulo no puede ser nulo.")

        normalized = value.strip()
        if not normalized:
            raise ValueError("El titulo no puede estar vacio.")
        return normalized

    @field_validator(
        "isbn",
        "description",
        "cover_url",
        "publisher_name",
        "collection_name",
        "author_country_name",
        "author_sex",
        "primary_author_first_name",
        "primary_author_last_name",
        "primary_author_display_name",
        "physical_location",
        "digital_location",
    )
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @field_validator("author_sex")
    @classmethod
    def normalize_optional_author_sex_value(cls, value: str | None) -> str | None:
        return normalize_author_sex(value)

    @field_validator("genre")
    @classmethod
    def normalize_optional_genre_value(cls, value: str | None) -> str | None:
        return normalize_literary_genre(value)

    @field_validator("authors")
    @classmethod
    def normalize_optional_collections(
        cls,
        value: list[str] | None,
    ) -> list[str] | None:
        if value is None:
            return None
        return _normalize_name_list(value)

    @field_validator("themes")
    @classmethod
    def normalize_optional_theme_values(
        cls,
        value: list[str] | None,
    ) -> list[str] | None:
        if value is None:
            return None
        return normalize_theme_list(value)

    @field_validator("format", "status")
    @classmethod
    def validate_non_nullable_enums(
        cls,
        value: CopyFormat | CopyStatus | None,
    ) -> CopyFormat | CopyStatus:
        if value is None:
            raise ValueError("Este campo no puede ser nulo.")
        return value


class BookMetadataUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    isbn: str | None = Field(default=None, max_length=32)
    publication_year: int | None = Field(default=None, ge=0, le=9999)
    description: str | None = None
    cover_url: str | None = Field(default=None, max_length=500)
    publisher_name: str | None = Field(default=None, max_length=255)
    collection_name: str | None = Field(default=None, max_length=255)
    author_country_name: str | None = Field(default=None, max_length=120)
    author_sex: str | None = Field(default=None, max_length=50)
    primary_author_first_name: str | None = Field(default=None, max_length=255)
    primary_author_last_name: str | None = Field(default=None, max_length=255)
    primary_author_display_name: str | None = Field(default=None, max_length=255)
    authors: list[str] | None = None
    genre: str | None = Field(default=None, max_length=32)
    themes: list[str] | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("title")
    @classmethod
    def normalize_metadata_title(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("El titulo no puede ser nulo.")

        normalized = value.strip()
        if not normalized:
            raise ValueError("El titulo no puede estar vacio.")
        return normalized

    @field_validator(
        "isbn",
        "description",
        "cover_url",
        "publisher_name",
        "collection_name",
        "author_country_name",
        "author_sex",
        "primary_author_first_name",
        "primary_author_last_name",
        "primary_author_display_name",
    )
    @classmethod
    def normalize_metadata_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @field_validator("author_sex")
    @classmethod
    def normalize_metadata_author_sex_value(cls, value: str | None) -> str | None:
        return normalize_author_sex(value)

    @field_validator("genre")
    @classmethod
    def normalize_metadata_genre_value(cls, value: str | None) -> str | None:
        return normalize_literary_genre(value)

    @field_validator("authors")
    @classmethod
    def normalize_metadata_optional_collections(
        cls,
        value: list[str] | None,
    ) -> list[str] | None:
        if value is None:
            return None
        return _normalize_name_list(value)

    @field_validator("themes")
    @classmethod
    def normalize_metadata_theme_values(
        cls,
        value: list[str] | None,
    ) -> list[str] | None:
        if value is None:
            return None
        return normalize_theme_list(value)


class CopyUpdate(BaseModel):
    format: CopyFormat | None = None
    physical_location: str | None = Field(default=None, max_length=255)
    digital_location: str | None = Field(default=None, max_length=500)
    status: CopyStatus | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator(
        "physical_location",
        "digital_location",
    )
    @classmethod
    def normalize_copy_optional_fields(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @field_validator("format", "status")
    @classmethod
    def validate_copy_non_nullable_enums(
        cls,
        value: CopyFormat | CopyStatus | None,
    ) -> CopyFormat | CopyStatus:
        if value is None:
            raise ValueError("Este campo no puede ser nulo.")
        return value


class BookOut(BaseModel):
    id: int
    book_id: int
    library_id: int
    title: str
    isbn: str | None
    publication_year: int | None
    description: str | None
    cover_url: str | None
    publisher: str | None
    collection: str | None
    author_country: str | None
    author_sex: str | None
    primary_author: PrimaryAuthorOut | None = None
    authors: list[str]
    genre: str | None
    themes: list[str]
    format: CopyFormat
    physical_location: str | None
    digital_location: str | None
    status: CopyStatus
    reading_status: ReadingStatus
    user_rating: int | None
    active_loan: CopyLoanOut | None = None
    shared_readers_preview: list[ReaderPreviewOut] = Field(default_factory=list)
    shared_readers_count: int = 0
    public_review_count: int = 0
    public_average_rating: float | None = None

    model_config = ConfigDict(from_attributes=True)


class CopyDetailOut(BaseModel):
    id: int
    book_id: int
    library_id: int
    title: str
    isbn: str | None
    publication_year: int | None
    description: str | None
    cover_url: str | None
    publisher: str | None
    collection: str | None
    author_country: str | None
    author_sex: str | None
    primary_author: PrimaryAuthorOut | None = None
    authors: list[str]
    genre: str | None
    themes: list[str]
    format: CopyFormat
    physical_location: str | None
    digital_location: str | None
    status: CopyStatus
    active_loan: CopyLoanOut | None = None
    shared_readers_preview: list[ReaderPreviewOut] = Field(default_factory=list)
    shared_readers_count: int = 0
    public_review_count: int = 0
    public_average_rating: float | None = None

    model_config = ConfigDict(from_attributes=True)


class BookMetadataOut(BaseModel):
    id: int
    title: str
    isbn: str | None
    publication_year: int | None
    description: str | None
    cover_url: str | None
    publisher: str | None
    collection: str | None
    author_country: str | None
    author_sex: str | None
    primary_author: PrimaryAuthorOut | None = None
    authors: list[str]
    genre: str | None
    themes: list[str]

    model_config = ConfigDict(from_attributes=True)
