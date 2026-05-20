from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import case
from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import Session

from app.models.book import Author
from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import BookTheme
from app.models.book import Collection
from app.models.book import Copy
from app.models.book import Country
from app.models.book import UserCopy
from app.models.enums import ReadingStatus
from app.models.library import Library
from app.models.library import UserLibrary
from app.models.social import Review
from app.schemas.reading import ReadingShelfItemOut
from app.services.libraries import READ_ACCESS_ROLES
from app.services.libraries import get_accessible_library
from app.services.social import attach_copy_social_summaries
from app.services.social import serialize_review

READING_LOAD_OPTIONS = (
    joinedload(Copy.book).joinedload(Book.collection),
    joinedload(Copy.book).joinedload(Book.publisher),
    joinedload(Copy.book)
    .selectinload(Book.book_authors)
    .joinedload(BookAuthor.author)
    .joinedload(Author.country),
    joinedload(Copy.book).selectinload(Book.book_themes).joinedload(BookTheme.theme),
)

ReadingShelfSort = Literal[
    "title",
    "author",
    "recent-start",
    "oldest-start",
    "recent-finish",
    "oldest-finish",
    "rating",
]


@dataclass(slots=True)
class ReadingShelfPage:
    items: list[ReadingShelfItemOut]
    total: int
    limit: int
    offset: int
    status_counts: dict[str, int]


def list_reading_shelf_page(
    db: Session,
    *,
    user_id: int,
    library_id: int | None = None,
    copy_id: int | None = None,
    q: str | None = None,
    reading_status: ReadingStatus | None = None,
    sort: ReadingShelfSort = "title",
    limit: int = 20,
    offset: int = 0,
) -> ReadingShelfPage:
    if library_id is not None:
        get_accessible_library(
            db,
            user_id=user_id,
            library_id=library_id,
            allowed_roles=READ_ACCESS_ROLES,
        )

    stmt = _build_reading_shelf_stmt(
        user_id=user_id,
        library_id=library_id,
        copy_id=copy_id,
        q=q,
        reading_status=reading_status,
    )
    total = db.scalar(
        select(func.count()).select_from(stmt.order_by(None).subquery()),
    ) or 0
    rows = db.execute(
        _apply_reading_shelf_sort(stmt.options(*READING_LOAD_OPTIONS), sort=sort)
        .offset(offset)
        .limit(limit),
    ).unique().all()
    copies = [copy for copy, _user_copy in rows]
    attach_copy_social_summaries(db, copies)
    my_reviews = _load_my_reviews(db, user_id=user_id, copies=copies)
    return ReadingShelfPage(
        items=[_serialize_reading_row(copy, user_copy, my_reviews.get(copy.id)) for copy, user_copy in rows],
        total=total,
        limit=limit,
        offset=offset,
        status_counts=_build_reading_status_counts(db, user_id=user_id, library_id=library_id),
    )


def _build_reading_shelf_stmt(
    *,
    user_id: int,
    library_id: int | None = None,
    copy_id: int | None = None,
    q: str | None = None,
    reading_status: ReadingStatus | None = None,
):
    stmt = (
        select(Copy, UserCopy)
        .join(Book, Book.id == Copy.book_id)
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .outerjoin(
            UserCopy,
            (UserCopy.copy_id == Copy.id) & (UserCopy.user_id == user_id),
        )
        .where(
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        )
    )
    if library_id is not None:
        stmt = stmt.where(Copy.library_id == library_id)
    if copy_id is not None:
        stmt = stmt.where(Copy.id == copy_id)

    normalized_q = q.strip().lower() if q else None
    if normalized_q:
        like_pattern = f"%{normalized_q}%"
        stmt = stmt.where(
            or_(
                func.lower(Book.title).like(like_pattern),
                func.lower(func.coalesce(Book.genre, "")).like(like_pattern),
                Book.collection.has(func.lower(Collection.name).like(like_pattern)),
                Book.book_authors.any(
                    BookAuthor.author.has(func.lower(Author.display_name).like(like_pattern)),
                ),
                Book.book_authors.any(
                    BookAuthor.author.has(
                        Author.country.has(func.lower(Country.name).like(like_pattern)),
                    ),
                ),
            ),
        )

    if reading_status is not None:
        if reading_status == ReadingStatus.PENDING:
            stmt = stmt.where(
                or_(
                    UserCopy.reading_status == ReadingStatus.PENDING,
                    UserCopy.reading_status.is_(None),
                ),
            )
        else:
            stmt = stmt.where(UserCopy.reading_status == reading_status)

    return stmt


def _apply_reading_shelf_sort(stmt, *, sort: ReadingShelfSort):
    title_sort = func.lower(Book.title)
    author_sort = (
        select(func.min(func.lower(Author.display_name)))
        .select_from(BookAuthor)
        .join(Author, Author.id == BookAuthor.author_id)
        .where(BookAuthor.book_id == Book.id)
        .correlate(Book)
        .scalar_subquery()
    )

    if sort == "author":
        return stmt.order_by(func.coalesce(author_sort, ""), title_sort, Copy.id.asc())
    if sort == "recent-start":
        return stmt.order_by(
            case((UserCopy.start_date.is_(None), 1), else_=0),
            UserCopy.start_date.desc(),
            title_sort,
            Copy.id.asc(),
        )
    if sort == "oldest-start":
        return stmt.order_by(
            case((UserCopy.start_date.is_(None), 1), else_=0),
            UserCopy.start_date.asc(),
            title_sort,
            Copy.id.asc(),
        )
    if sort == "recent-finish":
        return stmt.order_by(
            case((UserCopy.end_date.is_(None), 1), else_=0),
            UserCopy.end_date.desc(),
            title_sort,
            Copy.id.asc(),
        )
    if sort == "oldest-finish":
        return stmt.order_by(
            case((UserCopy.end_date.is_(None), 1), else_=0),
            UserCopy.end_date.asc(),
            title_sort,
            Copy.id.asc(),
        )
    if sort == "rating":
        return stmt.order_by(
            case((UserCopy.rating.is_(None), 1), else_=0),
            UserCopy.rating.desc(),
            title_sort,
            Copy.id.asc(),
        )

    return stmt.order_by(title_sort, Copy.id.asc())


def _build_reading_status_counts(
    db: Session,
    *,
    user_id: int,
    library_id: int | None,
) -> dict[str, int]:
    status_key = case(
        (UserCopy.reading_status == ReadingStatus.READING, ReadingStatus.READING.value),
        (UserCopy.reading_status == ReadingStatus.FINISHED, ReadingStatus.FINISHED.value),
        else_=ReadingStatus.PENDING.value,
    )
    stmt = (
        select(status_key.label("status"), func.count())
        .select_from(Copy)
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .outerjoin(
            UserCopy,
            (UserCopy.copy_id == Copy.id) & (UserCopy.user_id == user_id),
        )
        .where(
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        )
        .group_by(status_key)
    )
    if library_id is not None:
        stmt = stmt.where(Copy.library_id == library_id)

    counts = {
        ReadingStatus.PENDING.value: 0,
        ReadingStatus.READING.value: 0,
        ReadingStatus.FINISHED.value: 0,
    }
    for status_key_value, count in db.execute(stmt).all():
        counts[str(status_key_value)] = count
    return counts


def _load_my_reviews(
    db: Session,
    *,
    user_id: int,
    copies: list[Copy],
) -> dict[int, Review]:
    if not copies:
        return {}

    return {
        review.copy_id: review
        for review in db.execute(
            select(Review)
            .options(joinedload(Review.user))
            .where(
                Review.user_id == user_id,
                Review.copy_id.in_([copy.id for copy in copies]),
            ),
        ).scalars().all()
    }


def _serialize_reading_row(
    copy: Copy,
    user_copy: UserCopy | None,
    my_review: Review | None,
) -> ReadingShelfItemOut:
    book = copy.book
    primary_author_relation = _get_primary_author_relation(book)
    return ReadingShelfItemOut(
        copy_id=copy.id,
        book_id=book.id,
        library_id=copy.library_id,
        title=book.title,
        authors=_serialize_book_authors(book),
        themes=_serialize_book_themes(book),
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
        public_review_count=getattr(copy, "_social_public_review_count", 0),
        public_average_rating=getattr(copy, "_social_public_average_rating", None),
        my_public_review=serialize_review(my_review) if my_review is not None else None,
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


def _serialize_book_themes(book: Book) -> list[str]:
    return [
        relation.theme.name
        for relation in sorted(
            book.book_themes,
            key=lambda item: item.theme.name.casefold(),
        )
    ]
