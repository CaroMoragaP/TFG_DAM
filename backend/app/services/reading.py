from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import Session

from app.models.book import Author
from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import BookTheme
from app.models.book import Copy
from app.models.book import UserCopy
from app.models.enums import ReadingStatus
from app.models.library import Library
from app.models.library import UserLibrary
from app.schemas.reading import ReadingShelfItemOut
from app.services.libraries import READ_ACCESS_ROLES
from app.services.libraries import get_accessible_library

READING_LOAD_OPTIONS = (
    joinedload(Copy.book).joinedload(Book.collection),
    joinedload(Copy.book).joinedload(Book.publisher),
    joinedload(Copy.book)
    .selectinload(Book.book_authors)
    .joinedload(BookAuthor.author)
    .joinedload(Author.country),
    joinedload(Copy.book).selectinload(Book.book_themes).joinedload(BookTheme.theme),
)


def list_reading_shelf(
    db: Session,
    *,
    user_id: int,
    library_id: int | None = None,
) -> list[ReadingShelfItemOut]:
    if library_id is not None:
        get_accessible_library(
            db,
            user_id=user_id,
            library_id=library_id,
            allowed_roles=READ_ACCESS_ROLES,
        )

    stmt = (
        select(Copy, UserCopy)
        .join(Book, Book.id == Copy.book_id)
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .outerjoin(
            UserCopy,
            (UserCopy.copy_id == Copy.id) & (UserCopy.user_id == user_id),
        )
        .options(*READING_LOAD_OPTIONS)
        .where(
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        )
        .order_by(Book.title.asc(), Copy.id.asc())
    )
    if library_id is not None:
        stmt = stmt.where(Copy.library_id == library_id)

    rows = db.execute(stmt).unique().all()
    return [_serialize_reading_row(copy, user_copy) for copy, user_copy in rows]


def _serialize_reading_row(copy: Copy, user_copy: UserCopy | None) -> ReadingShelfItemOut:
    book = copy.book
    primary_author_relation = _get_primary_author_relation(book)
    return ReadingShelfItemOut(
        copy_id=copy.id,
        book_id=book.id,
        library_id=copy.library_id,
        title=book.title,
        authors=_serialize_book_authors(book),
        cover_url=book.cover_url,
        genre=book.genre,
        collection=book.collection.name if book.collection is not None else None,
        author_country=(
            primary_author_relation.author.country.name
            if primary_author_relation is not None and primary_author_relation.author.country is not None
            else None
        ),
        reading_status=user_copy.reading_status if user_copy is not None else ReadingStatus.PENDING,
        rating=user_copy.rating if user_copy is not None else None,
        start_date=user_copy.start_date if user_copy is not None else None,
        end_date=user_copy.end_date if user_copy is not None else None,
        personal_notes=user_copy.personal_notes if user_copy is not None else None,
    )


def _get_primary_author_relation(book: Book) -> BookAuthor | None:
    if not book.book_authors:
        return None

    return min(book.book_authors, key=lambda item: item.author.display_name.casefold())


def _serialize_book_authors(book: Book) -> list[str]:
    return [
        relation.author.display_name
        for relation in sorted(
            book.book_authors,
            key=lambda item: item.author.display_name.casefold(),
        )
    ]
