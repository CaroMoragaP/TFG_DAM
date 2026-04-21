from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from app.models.book import Author
from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import BookGenre
from app.models.book import Copy
from app.models.book import Genre
from app.models.book import Publisher
from app.models.enums import ReadingStatus
from app.models.library import UserLibrary
from app.schemas.book import BookCreate
from app.schemas.book import BookOut
from app.schemas.book import BookUpdate
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryPermissionDeniedError
from app.services.libraries import get_accessible_library


class BookNotFoundError(ValueError):
    """Raised when the requested book copy does not exist."""


class BookPermissionDeniedError(ValueError):
    """Raised when the user cannot access the requested book copy."""


class DuplicateBookCopyError(ValueError):
    """Raised when a library already contains the same logical book."""


class DuplicateBookIsbnError(ValueError):
    """Raised when trying to reuse an ISBN already assigned elsewhere."""


COPY_LOAD_OPTIONS = (
    joinedload(Copy.book).joinedload(Book.publisher),
    joinedload(Copy.book).selectinload(Book.book_authors).joinedload(BookAuthor.author),
    joinedload(Copy.book).selectinload(Book.book_genres).joinedload(BookGenre.genre),
)


def create_book(
    db: Session,
    *,
    user_id: int,
    data: BookCreate,
) -> Copy:
    get_accessible_library(db, user_id=user_id, library_id=data.library_id)

    book = _get_or_create_book(db, data)
    existing_copy = db.scalar(
        select(Copy).where(
            Copy.book_id == book.id,
            Copy.library_id == data.library_id,
        ),
    )
    if existing_copy is not None:
        raise DuplicateBookCopyError(
            "La biblioteca ya contiene un ejemplar de este libro.",
        )

    copy = Copy(
        book=book,
        library_id=data.library_id,
        format=data.format,
        physical_location=data.physical_location,
        digital_location=data.digital_location,
        status=data.status,
        reading_status=data.reading_status,
        user_rating=data.user_rating,
    )
    db.add(copy)
    db.commit()
    return get_book_copy(db, user_id=user_id, copy_id=copy.id)


def list_books(
    db: Session,
    *,
    user_id: int,
    library_id: int | None = None,
    q: str | None = None,
    genre: str | None = None,
    reading_status: ReadingStatus | None = None,
    min_rating: int | None = None,
) -> Sequence[Copy]:
    if library_id is not None:
        get_accessible_library(db, user_id=user_id, library_id=library_id)

    stmt = (
        select(Copy)
        .join(Book, Copy.book_id == Book.id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .outerjoin(Publisher, Publisher.id == Book.publisher_id)
        .outerjoin(BookAuthor, BookAuthor.book_id == Book.id)
        .outerjoin(Author, Author.id == BookAuthor.author_id)
        .outerjoin(BookGenre, BookGenre.book_id == Book.id)
        .outerjoin(Genre, Genre.id == BookGenre.genre_id)
        .options(*COPY_LOAD_OPTIONS)
        .where(UserLibrary.user_id == user_id)
        .order_by(Book.title.asc(), Copy.id.asc())
    )

    if library_id is not None:
        stmt = stmt.where(Copy.library_id == library_id)

    normalized_q = q.strip().lower() if q else None
    if normalized_q:
        like_pattern = f"%{normalized_q}%"
        stmt = stmt.where(
            or_(
                func.lower(Book.title).like(like_pattern),
                func.lower(func.coalesce(Book.isbn, "")).like(like_pattern),
                func.lower(func.coalesce(Publisher.name, "")).like(like_pattern),
                func.lower(func.coalesce(Author.name, "")).like(like_pattern),
            ),
        )

    normalized_genre = genre.strip().lower() if genre else None
    if normalized_genre:
        stmt = stmt.where(func.lower(func.coalesce(Genre.name, "")) == normalized_genre)

    if reading_status is not None:
        stmt = stmt.where(Copy.reading_status == reading_status)

    if min_rating is not None:
        stmt = stmt.where(Copy.user_rating.is_not(None), Copy.user_rating >= min_rating)

    return db.execute(stmt).unique().scalars().all()


def list_genres(db: Session) -> list[str]:
    stmt = select(Genre.name).order_by(func.lower(Genre.name).asc(), Genre.name.asc())
    return list(db.scalars(stmt).all())


def get_book_copy(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
) -> Copy:
    stmt = (
        select(Copy)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .options(*COPY_LOAD_OPTIONS)
        .where(
            Copy.id == copy_id,
            UserLibrary.user_id == user_id,
        )
    )
    copy = db.execute(stmt).unique().scalar_one_or_none()
    if copy is not None:
        return copy

    existing_copy = db.get(Copy, copy_id)
    if existing_copy is None:
        raise BookNotFoundError("El libro solicitado no existe.")

    raise BookPermissionDeniedError(
        "No tienes permisos para acceder a este libro.",
    )


def update_book(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
    data: BookUpdate,
) -> Copy:
    copy = get_book_copy(db, user_id=user_id, copy_id=copy_id)
    book = copy.book

    if "title" in data.model_fields_set:
        book.title = data.title
    if "isbn" in data.model_fields_set:
        _ensure_unique_isbn(db, isbn=data.isbn, current_book_id=book.id)
        book.isbn = data.isbn
    if "publication_year" in data.model_fields_set:
        book.publication_year = data.publication_year
    if "description" in data.model_fields_set:
        book.description = data.description
    if "cover_url" in data.model_fields_set:
        book.cover_url = data.cover_url
    if "publisher_name" in data.model_fields_set:
        book.publisher = _resolve_publisher(db, data.publisher_name)
    if "authors" in data.model_fields_set:
        book.book_authors = [
            BookAuthor(author=author)
            for author in _resolve_authors(db, data.authors or [])
        ]
    if "genres" in data.model_fields_set:
        book.book_genres = [
            BookGenre(genre=genre)
            for genre in _resolve_genres(db, data.genres or [])
        ]
    if "format" in data.model_fields_set:
        copy.format = data.format
    if "physical_location" in data.model_fields_set:
        copy.physical_location = data.physical_location
    if "digital_location" in data.model_fields_set:
        copy.digital_location = data.digital_location
    if "status" in data.model_fields_set:
        copy.status = data.status
    if "reading_status" in data.model_fields_set:
        copy.reading_status = data.reading_status
    if "user_rating" in data.model_fields_set:
        copy.user_rating = data.user_rating

    db.commit()
    return get_book_copy(db, user_id=user_id, copy_id=copy_id)


def delete_book(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
) -> None:
    copy = get_book_copy(db, user_id=user_id, copy_id=copy_id)
    db.delete(copy)
    db.commit()


def serialize_book_copy(copy: Copy) -> BookOut:
    book = copy.book
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
        authors=[
            relation.author.name
            for relation in sorted(book.book_authors, key=lambda item: item.author.name.casefold())
        ],
        genres=[
            relation.genre.name
            for relation in sorted(book.book_genres, key=lambda item: item.genre.name.casefold())
        ],
        format=copy.format,
        physical_location=copy.physical_location,
        digital_location=copy.digital_location,
        status=copy.status,
        reading_status=copy.reading_status,
        user_rating=copy.user_rating,
    )


def _get_or_create_book(db: Session, data: BookCreate) -> Book:
    if data.isbn is not None:
        existing_book = db.scalar(select(Book).where(Book.isbn == data.isbn))
        if existing_book is not None:
            return existing_book

    book = Book(
        title=data.title,
        isbn=data.isbn,
        publication_year=data.publication_year,
        description=data.description,
        cover_url=data.cover_url,
        publisher=_resolve_publisher(db, data.publisher_name),
        book_authors=[
            BookAuthor(author=author)
            for author in _resolve_authors(db, data.authors)
        ],
        book_genres=[
            BookGenre(genre=genre)
            for genre in _resolve_genres(db, data.genres)
        ],
    )
    db.add(book)
    db.flush()
    return book


def _resolve_publisher(db: Session, name: str | None) -> Publisher | None:
    if name is None:
        return None

    stmt = select(Publisher).where(func.lower(Publisher.name) == name.lower())
    publisher = db.scalar(stmt)
    if publisher is not None:
        return publisher

    publisher = Publisher(name=name)
    db.add(publisher)
    db.flush()
    return publisher


def _resolve_authors(db: Session, names: list[str]) -> list[Author]:
    authors: list[Author] = []

    for name in names:
        stmt = select(Author).where(func.lower(Author.name) == name.lower())
        author = db.scalar(stmt)
        if author is None:
            author = Author(name=name)
            db.add(author)
            db.flush()
        authors.append(author)

    return authors


def _resolve_genres(db: Session, names: list[str]) -> list[Genre]:
    genres: list[Genre] = []

    for name in names:
        stmt = select(Genre).where(func.lower(Genre.name) == name.lower())
        genre = db.scalar(stmt)
        if genre is None:
            genre = Genre(name=name)
            db.add(genre)
            db.flush()
        genres.append(genre)

    return genres


def _ensure_unique_isbn(
    db: Session,
    *,
    isbn: str | None,
    current_book_id: int,
) -> None:
    if isbn is None:
        return

    existing_book = db.scalar(
        select(Book).where(
            Book.isbn == isbn,
            Book.id != current_book_id,
        ),
    )
    if existing_book is not None:
        raise DuplicateBookIsbnError("Ya existe otro libro con ese ISBN.")
