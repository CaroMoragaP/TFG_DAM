from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import func
from sqlalchemy import or_
from sqlalchemy import select
from sqlalchemy.orm import aliased
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import Session

from app.core.author_names import StructuredAuthorName
from app.core.author_names import build_structured_author_name
from app.core.author_names import normalize_author_lookup_key
from app.core.book_fields import normalize_author_sex
from app.models.book import Author
from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import Collection
from app.models.book import BookGenre
from app.models.book import Copy
from app.models.book import Country
from app.models.book import Genre
from app.models.book import Publisher
from app.models.book import UserCopy
from app.models.enums import ReadingStatus
from app.models.enums import UserLibraryRole
from app.models.library import Library
from app.models.library import UserLibrary
from app.models.list import ListBook
from app.schemas.book import BookCreate
from app.schemas.book import BookMetadataOut
from app.schemas.book import BookMetadataUpdate
from app.schemas.book import BookOut
from app.schemas.book import CopyDetailOut
from app.schemas.book import CopyUpdate
from app.schemas.author import PrimaryAuthorOut
from app.services.libraries import CATALOG_MANAGEMENT_ROLES
from app.services.libraries import READ_ACCESS_ROLES
from app.services.libraries import LibraryArchivedError
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryOwnershipRequiredError
from app.services.libraries import LibraryPermissionDeniedError
from app.services.libraries import LibraryRoleRequiredError
from app.services.libraries import get_accessible_library
from app.services.libraries import get_user_library_membership
from app.services.lists import get_user_list
from app.services.user_copies import get_or_create_user_copy


class BookNotFoundError(ValueError):
    """Raised when the requested book copy does not exist."""


class BookPermissionDeniedError(ValueError):
    """Raised when the user cannot access the requested book copy."""


class DuplicateBookCopyError(ValueError):
    """Raised when a library already contains the same logical book."""


class DuplicateBookIsbnError(ValueError):
    """Raised when trying to reuse an ISBN already assigned elsewhere."""


def create_book_in_transaction(
    db: Session,
    *,
    user_id: int,
    data: BookCreate,
) -> Copy:
    del user_id
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
    )
    db.add(copy)
    db.flush()
    return copy


COPY_LOAD_OPTIONS = (
    joinedload(Copy.book).joinedload(Book.collection),
    joinedload(Copy.book).joinedload(Book.publisher),
    joinedload(Copy.book)
    .selectinload(Book.book_authors)
    .joinedload(BookAuthor.author)
    .joinedload(Author.country),
    joinedload(Copy.book).selectinload(Book.book_genres).joinedload(BookGenre.genre),
)
BOOK_LOAD_OPTIONS = (
    joinedload(Book.collection),
    joinedload(Book.publisher),
    selectinload(Book.book_authors).joinedload(BookAuthor.author).joinedload(Author.country),
    selectinload(Book.book_genres).joinedload(BookGenre.genre),
)
_UNSET = object()


def create_book(
    db: Session,
    *,
    user_id: int,
    data: BookCreate,
) -> Copy:
    get_accessible_library(
        db,
        user_id=user_id,
        library_id=data.library_id,
        allowed_roles=CATALOG_MANAGEMENT_ROLES,
    )

    copy = create_book_in_transaction(db, user_id=user_id, data=data)
    get_or_create_user_copy(
        db,
        user_id=user_id,
        copy_id=copy.id,
        seed_reading_status=data.reading_status,
        seed_rating=data.user_rating,
    )
    db.commit()
    return get_book_copy(db, user_id=user_id, copy_id=copy.id)


def list_books(
    db: Session,
    *,
    user_id: int,
    library_id: int | None = None,
    list_id: int | None = None,
    q: str | None = None,
    genre: str | None = None,
    collection: str | None = None,
    author_country: str | None = None,
    reading_status: ReadingStatus | None = None,
    min_rating: int | None = None,
) -> Sequence[Copy]:
    if library_id is not None:
        get_accessible_library(
            db,
            user_id=user_id,
            library_id=library_id,
            allowed_roles=READ_ACCESS_ROLES,
        )
    if list_id is not None:
        get_user_list(db, user_id=user_id, list_id=list_id)

    user_copy_alias = aliased(UserCopy)
    stmt = (
        select(Copy, user_copy_alias.reading_status, user_copy_alias.rating)
        .join(Book, Copy.book_id == Book.id)
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .outerjoin(
            user_copy_alias,
            (user_copy_alias.copy_id == Copy.id) & (user_copy_alias.user_id == user_id),
        )
        .outerjoin(Publisher, Publisher.id == Book.publisher_id)
        .outerjoin(Collection, Collection.id == Book.collection_id)
        .outerjoin(BookAuthor, BookAuthor.book_id == Book.id)
        .outerjoin(Author, Author.id == BookAuthor.author_id)
        .outerjoin(Country, Country.id == Author.country_id)
        .outerjoin(BookGenre, BookGenre.book_id == Book.id)
        .outerjoin(Genre, Genre.id == BookGenre.genre_id)
        .options(*COPY_LOAD_OPTIONS)
        .where(
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        )
        .order_by(Book.title.asc(), Copy.id.asc())
    )

    if library_id is not None:
        stmt = stmt.where(Copy.library_id == library_id)
    if list_id is not None:
        stmt = stmt.join(ListBook, ListBook.book_id == Book.id).where(ListBook.list_id == list_id)

    normalized_q = q.strip().lower() if q else None
    if normalized_q:
        like_pattern = f"%{normalized_q}%"
        stmt = stmt.where(
            or_(
                func.lower(Book.title).like(like_pattern),
                func.lower(func.coalesce(Book.isbn, "")).like(like_pattern),
                func.lower(func.coalesce(Publisher.name, "")).like(like_pattern),
                func.lower(func.coalesce(Author.display_name, "")).like(like_pattern),
            ),
        )

    normalized_genre = genre.strip().lower() if genre else None
    if normalized_genre:
        stmt = stmt.where(func.lower(func.coalesce(Genre.name, "")) == normalized_genre)

    normalized_collection = collection.strip().lower() if collection else None
    if normalized_collection:
        stmt = stmt.where(
            func.lower(func.coalesce(Collection.name, "")) == normalized_collection,
        )

    normalized_author_country = author_country.strip().lower() if author_country else None
    if normalized_author_country:
        stmt = stmt.where(
            func.lower(func.coalesce(Country.name, "")) == normalized_author_country,
        )

    if reading_status is not None:
        if reading_status == ReadingStatus.PENDING:
            stmt = stmt.where(
                or_(
                    user_copy_alias.reading_status == reading_status,
                    user_copy_alias.reading_status.is_(None),
                ),
            )
        else:
            stmt = stmt.where(user_copy_alias.reading_status == reading_status)

    if min_rating is not None:
        stmt = stmt.where(user_copy_alias.rating.is_not(None), user_copy_alias.rating >= min_rating)

    rows = db.execute(stmt).unique().all()
    return _hydrate_copy_personal_fields(rows)


def list_genres(db: Session) -> list[str]:
    stmt = select(Genre.name).order_by(func.lower(Genre.name).asc(), Genre.name.asc())
    return list(db.scalars(stmt).all())


def get_book_copy(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
    allowed_roles: frozenset[UserLibraryRole] = READ_ACCESS_ROLES,
) -> Copy:
    rows = db.execute(
        _build_copy_query(user_id=user_id).where(
            Copy.id == copy_id,
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        ),
    ).unique().all()
    copies = _hydrate_copy_personal_fields(rows)
    copy = copies[0] if copies else None
    if copy is not None:
        get_user_library_membership(
            db,
            user_id=user_id,
            library_id=copy.library_id,
            allowed_roles=allowed_roles,
        )
        return copy

    existing_copy = db.get(Copy, copy_id)
    if existing_copy is None:
        raise BookNotFoundError("El libro solicitado no existe.")

    _assert_copy_access(
        db,
        user_id=user_id,
        copy=existing_copy,
        allowed_roles=allowed_roles,
    )
    raise BookPermissionDeniedError(
        "No tienes permisos para acceder a este libro.",
    )


def update_copy(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
    data: CopyUpdate,
) -> Copy:
    copy = get_book_copy(
        db,
        user_id=user_id,
        copy_id=copy_id,
        allowed_roles=CATALOG_MANAGEMENT_ROLES,
    )

    if "format" in data.model_fields_set:
        copy.format = data.format
    if "physical_location" in data.model_fields_set:
        copy.physical_location = data.physical_location
    if "digital_location" in data.model_fields_set:
        copy.digital_location = data.digital_location
    if "status" in data.model_fields_set:
        copy.status = data.status

    db.commit()
    return get_book_copy(db, user_id=user_id, copy_id=copy_id)


def update_book_metadata(
    db: Session,
    *,
    user_id: int,
    book_id: int,
    data: BookMetadataUpdate,
) -> Book:
    book = _get_editable_book_for_owner(db, user_id=user_id, book_id=book_id)

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
    if "collection_name" in data.model_fields_set:
        book.collection = _resolve_collection(db, data.collection_name)
    if _author_fields_present(data):
        book.book_authors = [
            BookAuthor(author=author)
            for author in _resolve_authors(db, _build_author_inputs(data))
        ]
    if "author_country_name" in data.model_fields_set or "author_sex" in data.model_fields_set:
        _assign_primary_author_metadata(
            book.book_authors,
            country=(
                _resolve_country(db, data.author_country_name)
                if "author_country_name" in data.model_fields_set
                else _UNSET
            ),
            sex=data.author_sex if "author_sex" in data.model_fields_set else _UNSET,
        )
    if "genres" in data.model_fields_set:
        book.book_genres = [
            BookGenre(genre=genre)
            for genre in _resolve_genres(db, data.genres or [])
        ]

    db.commit()
    db.refresh(book)
    return _get_editable_book_for_owner(db, user_id=user_id, book_id=book_id)


def delete_copy(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
) -> None:
    copy = get_book_copy(
        db,
        user_id=user_id,
        copy_id=copy_id,
        allowed_roles=CATALOG_MANAGEMENT_ROLES,
    )
    db.delete(copy)
    db.commit()


def serialize_book_copy(copy: Copy) -> BookOut:
    book = copy.book
    reading_status = getattr(copy, "_catalog_reading_status", ReadingStatus.PENDING)
    user_rating = getattr(copy, "_catalog_user_rating", None)
    primary_author = _get_primary_author(book)
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
        genres=[
            relation.genre.name
            for relation in sorted(book.book_genres, key=lambda item: item.genre.name.casefold())
        ],
        format=copy.format,
        physical_location=copy.physical_location,
        digital_location=copy.digital_location,
        status=copy.status,
        reading_status=reading_status,
        user_rating=user_rating,
    )


def serialize_copy_detail(copy: Copy) -> CopyDetailOut:
    book = copy.book
    primary_author = _get_primary_author(book)
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
        genres=[
            relation.genre.name
            for relation in sorted(book.book_genres, key=lambda item: item.genre.name.casefold())
        ],
        format=copy.format,
        physical_location=copy.physical_location,
        digital_location=copy.digital_location,
        status=copy.status,
    )


def serialize_book_metadata(book: Book) -> BookMetadataOut:
    primary_author = _get_primary_author(book)
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
        genres=[
            relation.genre.name
            for relation in sorted(book.book_genres, key=lambda item: item.genre.name.casefold())
        ],
    )


def _get_or_create_book(db: Session, data: BookCreate) -> Book:
    if data.isbn is not None:
        existing_book = db.scalar(select(Book).where(Book.isbn == data.isbn))
        if existing_book is not None:
            return existing_book

    existing_book = _find_existing_book_by_identity(db, data)
    if existing_book is not None:
        return existing_book

    publisher = _resolve_publisher(db, data.publisher_name)
    collection = _resolve_collection(db, data.collection_name)
    authors = _resolve_authors(db, _build_author_inputs(data))
    genres = _resolve_genres(db, data.genres)
    book_authors = [BookAuthor(author=author) for author in authors]

    book = Book(
        title=data.title,
        isbn=data.isbn,
        publication_year=data.publication_year,
        description=data.description,
        cover_url=data.cover_url,
        publisher=publisher,
        collection=collection,
    )
    db.add(book)
    book.book_authors = book_authors
    book.book_genres = [
        BookGenre(genre=genre)
        for genre in genres
    ]
    _assign_primary_author_metadata(
        book.book_authors,
        country=_resolve_country(db, data.author_country_name),
        sex=data.author_sex,
    )
    db.flush()
    return book


def _get_editable_book_for_owner(
    db: Session,
    *,
    user_id: int,
    book_id: int,
) -> Book:
    stmt = (
        select(Book)
        .join(Copy, Copy.book_id == Book.id)
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Library.id)
        .options(*BOOK_LOAD_OPTIONS)
        .where(
            Book.id == book_id,
            UserLibrary.user_id == user_id,
            UserLibrary.role == UserLibraryRole.OWNER,
            Library.archived_at.is_(None),
        )
        .order_by(Copy.id.asc())
    )
    book = db.execute(stmt).unique().scalar_one_or_none()
    if book is not None:
        return book

    existing_book = db.get(Book, book_id)
    if existing_book is None:
        raise BookNotFoundError("El libro solicitado no existe.")

    candidate_copy = db.scalar(
        select(Copy)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .where(
            Copy.book_id == book_id,
            UserLibrary.user_id == user_id,
        )
        .order_by(Copy.id.asc())
    )
    if candidate_copy is None:
        raise BookPermissionDeniedError(
            "No tienes permisos para acceder a este libro.",
        )

    get_user_library_membership(
        db,
        user_id=user_id,
        library_id=candidate_copy.library_id,
        allowed_roles=frozenset({UserLibraryRole.OWNER}),
    )
    raise BookPermissionDeniedError(
        "No tienes permisos para editar este libro.",
    )


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


def _resolve_collection(db: Session, name: str | None) -> Collection | None:
    if name is None:
        return None

    stmt = select(Collection).where(func.lower(Collection.name) == name.lower())
    collection = db.scalar(stmt)
    if collection is not None:
        return collection

    collection = Collection(name=name)
    db.add(collection)
    db.flush()
    return collection


def _resolve_authors(db: Session, names: list[StructuredAuthorName]) -> list[Author]:
    authors: list[Author] = []

    for name in names:
        if name.display_name is None:
            continue
        stmt = select(Author).where(func.lower(Author.display_name) == name.display_name.lower())
        author = db.scalar(stmt)
        if author is None:
            author = Author(
                first_name=name.first_name,
                last_name=name.last_name,
                display_name=name.display_name,
            )
            db.add(author)
            db.flush()
        authors.append(author)

    return authors


def _resolve_country(db: Session, name: str | None) -> Country | None:
    if name is None:
        return None

    stmt = select(Country).where(func.lower(Country.name) == name.lower())
    country = db.scalar(stmt)
    if country is not None:
        return country

    country = Country(name=name)
    db.add(country)
    db.flush()
    return country


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


def _assign_primary_author_metadata(
    book_authors: list[BookAuthor],
    *,
    country: Country | None | object = _UNSET,
    sex: str | None | object = _UNSET,
) -> None:
    if not book_authors:
        return

    primary_relation = min(book_authors, key=lambda item: item.author.display_name.casefold())
    if country is not _UNSET:
        primary_relation.author.country = country
    if sex is not _UNSET:
        primary_relation.author.sex = sex


def _serialize_primary_author_country(book: Book) -> str | None:
    if not book.book_authors:
        return None

    primary_relation = min(book.book_authors, key=lambda item: item.author.display_name.casefold())
    if primary_relation.author.country is None:
        return None
    return primary_relation.author.country.name


def _serialize_primary_author_sex(book: Book) -> str | None:
    if not book.book_authors:
        return None

    primary_relation = min(book.book_authors, key=lambda item: item.author.display_name.casefold())
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


def _get_primary_author(book: Book) -> Author | None:
    if not book.book_authors:
        return None

    return min(
        (relation.author for relation in book.book_authors),
        key=lambda author: author.display_name.casefold(),
    )


def _author_fields_present(data: BookMetadataUpdate) -> bool:
    return bool(
        {"authors", "primary_author_first_name", "primary_author_last_name", "primary_author_display_name"}
        & data.model_fields_set
    )


def _build_author_inputs(data: BookCreate | BookMetadataUpdate) -> list[StructuredAuthorName]:
    primary_author = build_structured_author_name(
        first_name=getattr(data, "primary_author_first_name", None),
        last_name=getattr(data, "primary_author_last_name", None),
        display_name=getattr(data, "primary_author_display_name", None),
    )
    if primary_author.display_name is not None:
        return [primary_author]

    return [
        build_structured_author_name(display_name=name)
        for name in (getattr(data, "authors", None) or [])
    ]


def _find_existing_book_by_identity(db: Session, data: BookCreate) -> Book | None:
    author_inputs = _build_author_inputs(data)
    if not author_inputs or author_inputs[0].display_name is None:
        return None

    normalized_author_name = normalize_author_lookup_key(author_inputs[0].display_name)
    if normalized_author_name is None:
        return None

    candidates = db.execute(
        select(Book)
        .join(BookAuthor, BookAuthor.book_id == Book.id)
        .join(Author, Author.id == BookAuthor.author_id)
        .options(*BOOK_LOAD_OPTIONS)
        .where(func.lower(Book.title) == data.title.lower())
    ).unique().scalars().all()

    for candidate in candidates:
        primary_author = _get_primary_author(candidate)
        if primary_author is None:
            continue
        if normalize_author_lookup_key(primary_author.display_name) == normalized_author_name:
            return candidate

    return None


def _assert_copy_access(
    db: Session,
    *,
    user_id: int,
    copy: Copy,
    allowed_roles: frozenset[UserLibraryRole],
) -> None:
    get_user_library_membership(
        db,
        user_id=user_id,
        library_id=copy.library_id,
        allowed_roles=allowed_roles,
    )


def _build_copy_query(*, user_id: int):
    user_copy_alias = aliased(UserCopy)
    return (
        select(Copy, user_copy_alias.reading_status, user_copy_alias.rating)
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .outerjoin(
            user_copy_alias,
            (user_copy_alias.copy_id == Copy.id) & (user_copy_alias.user_id == user_id),
        )
        .options(*COPY_LOAD_OPTIONS)
    )


def _hydrate_copy_personal_fields(
    rows: Sequence[tuple[Copy, ReadingStatus | None, int | None]],
) -> list[Copy]:
    copies: list[Copy] = []
    for copy, reading_status, rating in rows:
        setattr(copy, "_catalog_reading_status", reading_status or ReadingStatus.PENDING)
        setattr(copy, "_catalog_user_rating", rating)
        copies.append(copy)
    return copies
