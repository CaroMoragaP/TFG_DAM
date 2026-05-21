from __future__ import annotations

from app.core.book_fields import normalize_author_sex
from app.models.book import Author
from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import Copy
from app.models.enums import ReadingStatus
from app.schemas.author import PrimaryAuthorOut
from app.schemas.book import BookMetadataOut
from app.schemas.book import BookOut
from app.schemas.book import CopyDetailOut


def serialize_book_copy(copy: Copy) -> BookOut:
    book = copy.book
    reading_status = getattr(copy, "_catalog_reading_status", ReadingStatus.PENDING)
    user_rating = getattr(copy, "_catalog_user_rating", None)
    primary_author = get_primary_author(book)
    return BookOut(
        id=copy.id,
        book_id=book.id,
        library_id=copy.library_id,
        title=book.title,
        isbn=book.isbn,
        publication_year=book.publication_year,
        description=book.description,
        cover_url=book.cover_url,
        publisher=book.publisher.name if book.publisher is not None else None,
        collection=book.collection.name if book.collection is not None else None,
        author_country=_serialize_primary_author_country(book),
        author_sex=_serialize_primary_author_sex(book),
        primary_author=_serialize_primary_author(primary_author),
        authors=_serialize_book_authors(book),
        genre=book.genre,
        themes=_serialize_book_themes(book),
        format=copy.format,
        physical_location=copy.physical_location,
        digital_location=copy.digital_location,
        status=copy.status,
        reading_status=reading_status,
        user_rating=user_rating,
        active_loan=getattr(copy, "_social_active_loan", None),
        shared_readers_preview=getattr(copy, "_social_shared_readers_preview", []),
        shared_readers_count=getattr(copy, "_social_shared_readers_count", 0),
        public_review_count=getattr(copy, "_social_public_review_count", 0),
        public_average_rating=getattr(copy, "_social_public_average_rating", None),
    )


def serialize_copy_detail(copy: Copy) -> CopyDetailOut:
    book = copy.book
    primary_author = get_primary_author(book)
    return CopyDetailOut(
        id=copy.id,
        book_id=book.id,
        library_id=copy.library_id,
        title=book.title,
        isbn=book.isbn,
        publication_year=book.publication_year,
        description=book.description,
        cover_url=book.cover_url,
        publisher=book.publisher.name if book.publisher is not None else None,
        collection=book.collection.name if book.collection is not None else None,
        author_country=_serialize_primary_author_country(book),
        author_sex=_serialize_primary_author_sex(book),
        primary_author=_serialize_primary_author(primary_author),
        authors=_serialize_book_authors(book),
        genre=book.genre,
        themes=_serialize_book_themes(book),
        format=copy.format,
        physical_location=copy.physical_location,
        digital_location=copy.digital_location,
        status=copy.status,
        active_loan=getattr(copy, "_social_active_loan", None),
        shared_readers_preview=getattr(copy, "_social_shared_readers_preview", []),
        shared_readers_count=getattr(copy, "_social_shared_readers_count", 0),
        public_review_count=getattr(copy, "_social_public_review_count", 0),
        public_average_rating=getattr(copy, "_social_public_average_rating", None),
    )


def serialize_book_metadata(book: Book) -> BookMetadataOut:
    primary_author = get_primary_author(book)
    return BookMetadataOut(
        id=book.id,
        title=book.title,
        isbn=book.isbn,
        publication_year=book.publication_year,
        description=book.description,
        cover_url=book.cover_url,
        publisher=book.publisher.name if book.publisher is not None else None,
        collection=book.collection.name if book.collection is not None else None,
        author_country=_serialize_primary_author_country(book),
        author_sex=_serialize_primary_author_sex(book),
        primary_author=_serialize_primary_author(primary_author),
        authors=_serialize_book_authors(book),
        genre=book.genre,
        themes=_serialize_book_themes(book),
    )


def get_primary_author(book: Book) -> Author | None:
    primary_relation = _get_primary_book_author(book)
    if primary_relation is None:
        return None

    return primary_relation.author


def _serialize_primary_author_country(book: Book) -> str | None:
    primary_relation = _get_primary_book_author(book)
    if primary_relation is None or primary_relation.author.country is None:
        return None

    return primary_relation.author.country.name


def _serialize_primary_author_sex(book: Book) -> str | None:
    primary_relation = _get_primary_book_author(book)
    if primary_relation is None:
        return None

    return normalize_author_sex(primary_relation.author.sex, invalid_fallback="unknown")


def _serialize_primary_author(author: Author | None) -> PrimaryAuthorOut | None:
    if author is None:
        return None

    return PrimaryAuthorOut(
        first_name=author.first_name,
        last_name=author.last_name,
        display_name=author.display_name,
    )


def _serialize_book_authors(book: Book) -> list[str]:
    return [
        relation.author.display_name
        for relation in sorted(
            book.book_authors,
            key=lambda item: item.author.display_name.casefold(),
        )
    ]


def _serialize_book_themes(book: Book) -> list[str]:
    return [
        relation.theme.name
        for relation in sorted(book.book_themes, key=lambda item: item.theme.name.casefold())
    ]


def _get_primary_book_author_relations(book_authors: list[BookAuthor]) -> BookAuthor | None:
    if not book_authors:
        return None

    return min(book_authors, key=lambda item: item.author.display_name.casefold())


def _get_primary_book_author(book: Book) -> BookAuthor | None:
    return _get_primary_book_author_relations(book.book_authors)
