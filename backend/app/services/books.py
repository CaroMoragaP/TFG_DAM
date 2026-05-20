from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from dataclasses import field

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
from app.core.book_fields import normalize_literary_genre
from app.core.themes import list_theme_labels
from app.core.themes import normalize_theme
from app.models.book import Author
from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import BookTheme
from app.models.book import Collection
from app.models.book import Copy
from app.models.book import Country
from app.models.book import Publisher
from app.models.book import Theme
from app.models.book import UserCopy
from app.models.enums import ReadingStatus
from app.models.enums import UserLibraryRole
from app.models.library import Library
from app.models.library import UserLibrary
from app.models.list import ListBook
from app.schemas.author import PrimaryAuthorOut
from app.schemas.book import BookCreate
from app.schemas.book import BookMetadataOut
from app.schemas.book import BookMetadataUpdate
from app.schemas.book import BookOut
from app.schemas.book import CopyDetailOut
from app.schemas.book import CopyUpdate
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
from app.services.social import attach_copy_social_summaries
from app.services.social import record_book_added_event
from app.services.social import validate_copy_status_update
from app.services.user_copies import get_or_create_user_copy


class BookNotFoundError(ValueError):
    """Raised when the requested book copy does not exist."""


class BookPermissionDeniedError(ValueError):
    """Raised when the user cannot access the requested book copy."""


class DuplicateBookCopyError(ValueError):
    """Raised when a library already contains the same logical book."""


class DuplicateBookIsbnError(ValueError):
    """Raised when trying to reuse an ISBN already assigned elsewhere."""


@dataclass(slots=True)
class BooksPage:
    items: list[Copy]
    total: int
    limit: int
    offset: int


@dataclass
class ImportResolverCache:
    publishers: dict[str, Publisher] = field(default_factory=dict)
    collections: dict[str, Collection] = field(default_factory=dict)
    authors: dict[str, Author] = field(default_factory=dict)
    countries: dict[str, Country] = field(default_factory=dict)
    themes: dict[str, Theme] = field(default_factory=dict)
    books_by_isbn: dict[str, Book] = field(default_factory=dict)
    books_by_identity: dict[str, Book] = field(default_factory=dict)

    def clone(self) -> ImportResolverCache:
        return ImportResolverCache(
            publishers=self.publishers.copy(),
            collections=self.collections.copy(),
            authors=self.authors.copy(),
            countries=self.countries.copy(),
            themes=self.themes.copy(),
            books_by_isbn=self.books_by_isbn.copy(),
            books_by_identity=self.books_by_identity.copy(),
        )


def create_book_in_transaction(
    db: Session,
    *,
    user_id: int,
    data: BookCreate,
    resolver_cache: ImportResolverCache | None = None,
) -> Copy:
    del user_id
    book = _get_or_create_book(db, data, resolver_cache=resolver_cache)
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
    joinedload(Copy.library),
    joinedload(Copy.book).joinedload(Book.collection),
    joinedload(Copy.book).joinedload(Book.publisher),
    joinedload(Copy.book)
    .selectinload(Book.book_authors)
    .joinedload(BookAuthor.author)
    .joinedload(Author.country),
    joinedload(Copy.book).selectinload(Book.book_themes).joinedload(BookTheme.theme),
)
BOOK_LOAD_OPTIONS = (
    joinedload(Book.collection),
    joinedload(Book.publisher),
    selectinload(Book.book_authors).joinedload(BookAuthor.author).joinedload(Author.country),
    selectinload(Book.book_themes).joinedload(BookTheme.theme),
)
_UNSET = object()


def create_book(
    db: Session,
    *,
    user_id: int,
    data: BookCreate,
) -> Copy:
    library = get_accessible_library(
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
    record_book_added_event(
        db,
        library=library,
        actor_user_id=user_id,
        copy=copy,
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
    theme: str | None = None,
    collection: str | None = None,
    author_country: str | None = None,
    reading_status: ReadingStatus | None = None,
    min_rating: int | None = None,
) -> Sequence[Copy]:
    stmt = _build_list_books_stmt(
        db,
        user_id=user_id,
        library_id=library_id,
        list_id=list_id,
        q=q,
        genre=genre,
        theme=theme,
        collection=collection,
        author_country=author_country,
        reading_status=reading_status,
        min_rating=min_rating,
    )
    if stmt is None:
        return []

    rows = db.execute(
        stmt.options(*COPY_LOAD_OPTIONS).order_by(Book.title.asc(), Copy.id.asc()),
    ).unique().all()
    copies = _hydrate_copy_personal_fields(rows)
    attach_copy_social_summaries(db, copies)
    return copies


def list_books_page(
    db: Session,
    *,
    user_id: int,
    library_id: int | None = None,
    list_id: int | None = None,
    q: str | None = None,
    genre: str | None = None,
    theme: str | None = None,
    collection: str | None = None,
    author_country: str | None = None,
    reading_status: ReadingStatus | None = None,
    min_rating: int | None = None,
    limit: int,
    offset: int,
) -> BooksPage:
    stmt = _build_list_books_stmt(
        db,
        user_id=user_id,
        library_id=library_id,
        list_id=list_id,
        q=q,
        genre=genre,
        theme=theme,
        collection=collection,
        author_country=author_country,
        reading_status=reading_status,
        min_rating=min_rating,
    )
    if stmt is None:
        return BooksPage(items=[], total=0, limit=limit, offset=offset)

    total = db.scalar(
        select(func.count()).select_from(stmt.order_by(None).subquery()),
    ) or 0
    rows = db.execute(
        stmt.options(*COPY_LOAD_OPTIONS)
        .order_by(Book.title.asc(), Copy.id.asc())
        .offset(offset)
        .limit(limit),
    ).unique().all()
    copies = _hydrate_copy_personal_fields(rows)
    attach_copy_social_summaries(db, copies)
    return BooksPage(items=copies, total=total, limit=limit, offset=offset)


def _build_list_books_stmt(
    db: Session,
    *,
    user_id: int,
    library_id: int | None = None,
    list_id: int | None = None,
    q: str | None = None,
    genre: str | None = None,
    theme: str | None = None,
    collection: str | None = None,
    author_country: str | None = None,
    reading_status: ReadingStatus | None = None,
    min_rating: int | None = None,
):
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
        .options(*COPY_LOAD_OPTIONS)
        .where(
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        )
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
                Book.publisher.has(func.lower(Publisher.name).like(like_pattern)),
                Book.book_authors.any(
                    BookAuthor.author.has(func.lower(Author.display_name).like(like_pattern)),
                ),
                Book.book_themes.any(
                    BookTheme.theme.has(func.lower(Theme.name).like(like_pattern)),
                ),
            ),
        )

    normalized_genre = normalize_literary_genre(genre, invalid_fallback="__invalid__")
    if normalized_genre == "__invalid__":
        return None
    if normalized_genre:
        stmt = stmt.where(Book.genre == normalized_genre)

    normalized_theme = normalize_theme(theme, invalid_fallback="__invalid__")
    if normalized_theme == "__invalid__":
        return None
    if normalized_theme:
        stmt = stmt.where(
            Book.book_themes.any(
                BookTheme.theme.has(Theme.name == normalized_theme),
            ),
        )

    normalized_collection = collection.strip().lower() if collection else None
    if normalized_collection:
        collection_like_pattern = f"%{normalized_collection}%"
        stmt = stmt.where(
            Book.collection.has(func.lower(Collection.name).like(collection_like_pattern)),
        )

    normalized_author_country = author_country.strip().lower() if author_country else None
    if normalized_author_country:
        author_country_like_pattern = f"%{normalized_author_country}%"
        stmt = stmt.where(
            Book.book_authors.any(
                BookAuthor.author.has(
                    Author.country.has(
                        func.lower(Country.name).like(author_country_like_pattern),
                    ),
                ),
            ),
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

    return stmt


def list_themes(db: Session) -> list[str]:
    del db
    return list_theme_labels()


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
        attach_copy_social_summaries(db, [copy])
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
        validate_copy_status_update(db, copy_id=copy.id, status=data.status)
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

    if "title" in data.model_fields_set and data.title is not None:
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
    if "genre" in data.model_fields_set:
        book.genre = data.genre
    if _author_fields_present(data):
        book.book_authors = [
            BookAuthor(author=author)
            for author in _resolve_authors(db, _build_author_inputs(data))
        ]
        db.flush()
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
    if "themes" in data.model_fields_set:
        book.book_themes = [
            BookTheme(theme=theme)
            for theme in _resolve_themes(db, data.themes or [])
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
        genre=book.genre,
        themes=_serialize_book_themes(book),
    )


def _get_or_create_book(
    db: Session,
    data: BookCreate,
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> Book:
    if data.isbn is not None:
        normalized_isbn = _normalize_text_lookup_key(data.isbn)
        if resolver_cache is not None and normalized_isbn is not None:
            cached_book = resolver_cache.books_by_isbn.get(normalized_isbn)
            if cached_book is not None:
                return cached_book

        existing_book = db.scalar(select(Book).where(Book.isbn == data.isbn))
        if existing_book is not None:
            if resolver_cache is not None and normalized_isbn is not None:
                resolver_cache.books_by_isbn[normalized_isbn] = existing_book
            return existing_book

    existing_book = _find_existing_book_by_identity(db, data, resolver_cache=resolver_cache)
    if existing_book is not None:
        return existing_book

    publisher = _resolve_publisher(db, data.publisher_name, resolver_cache=resolver_cache)
    collection = _resolve_collection(db, data.collection_name, resolver_cache=resolver_cache)
    authors = _resolve_authors(db, _build_author_inputs(data), resolver_cache=resolver_cache)
    themes = _resolve_themes(db, data.themes, resolver_cache=resolver_cache)
    book_authors = [BookAuthor(author=author) for author in authors]

    book = Book(
        title=data.title,
        isbn=data.isbn,
        publication_year=data.publication_year,
        description=data.description,
        cover_url=data.cover_url,
        publisher=publisher,
        collection=collection,
        genre=data.genre,
    )
    db.add(book)
    book.book_authors = book_authors
    book.book_themes = [
        BookTheme(theme=theme)
        for theme in themes
    ]
    _assign_primary_author_metadata(
        book.book_authors,
        country=_resolve_country(db, data.author_country_name, resolver_cache=resolver_cache),
        sex=data.author_sex,
    )
    db.flush()
    if resolver_cache is not None:
        if data.isbn is not None and normalized_isbn is not None:
            resolver_cache.books_by_isbn[normalized_isbn] = book
        identity_key = _build_book_identity_cache_key(data)
        if identity_key is not None:
            resolver_cache.books_by_identity[identity_key] = book
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


def _resolve_publisher(
    db: Session,
    name: str | None,
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> Publisher | None:
    if name is None:
        return None

    cache_key = _normalize_text_lookup_key(name)
    if resolver_cache is not None and cache_key is not None:
        cached_publisher = resolver_cache.publishers.get(cache_key)
        if cached_publisher is not None:
            return cached_publisher

    stmt = select(Publisher).where(func.lower(Publisher.name) == name.lower())
    publisher = db.scalar(stmt)
    if publisher is not None:
        if resolver_cache is not None and cache_key is not None:
            resolver_cache.publishers[cache_key] = publisher
        return publisher

    publisher = Publisher(name=name)
    db.add(publisher)
    db.flush()
    if resolver_cache is not None and cache_key is not None:
        resolver_cache.publishers[cache_key] = publisher
    return publisher


def _resolve_collection(
    db: Session,
    name: str | None,
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> Collection | None:
    if name is None:
        return None

    cache_key = _normalize_text_lookup_key(name)
    if resolver_cache is not None and cache_key is not None:
        cached_collection = resolver_cache.collections.get(cache_key)
        if cached_collection is not None:
            return cached_collection

    stmt = select(Collection).where(func.lower(Collection.name) == name.lower())
    collection = db.scalar(stmt)
    if collection is not None:
        if resolver_cache is not None and cache_key is not None:
            resolver_cache.collections[cache_key] = collection
        return collection

    collection = Collection(name=name)
    db.add(collection)
    db.flush()
    if resolver_cache is not None and cache_key is not None:
        resolver_cache.collections[cache_key] = collection
    return collection


def _resolve_authors(
    db: Session,
    names: list[StructuredAuthorName],
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> list[Author]:
    authors: list[Author] = []

    for name in names:
        if name.display_name is None:
            continue
        cache_key = _normalize_text_lookup_key(name.display_name)
        if resolver_cache is not None and cache_key is not None:
            cached_author = resolver_cache.authors.get(cache_key)
            if cached_author is not None:
                authors.append(cached_author)
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
        if resolver_cache is not None and cache_key is not None:
            resolver_cache.authors[cache_key] = author
        authors.append(author)

    return authors


def _resolve_country(
    db: Session,
    name: str | None,
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> Country | None:
    if name is None:
        return None

    cache_key = _normalize_text_lookup_key(name)
    if resolver_cache is not None and cache_key is not None:
        cached_country = resolver_cache.countries.get(cache_key)
        if cached_country is not None:
            return cached_country

    stmt = select(Country).where(func.lower(Country.name) == name.lower())
    country = db.scalar(stmt)
    if country is not None:
        if resolver_cache is not None and cache_key is not None:
            resolver_cache.countries[cache_key] = country
        return country

    country = Country(name=name)
    db.add(country)
    db.flush()
    if resolver_cache is not None and cache_key is not None:
        resolver_cache.countries[cache_key] = country
    return country


def _resolve_themes(
    db: Session,
    names: list[str],
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> list[Theme]:
    themes: list[Theme] = []

    for name in names:
        canonical_name = normalize_theme(name)
        if canonical_name is None:
            continue

        if resolver_cache is not None:
            cached_theme = resolver_cache.themes.get(canonical_name)
            if cached_theme is not None:
                themes.append(cached_theme)
                continue

        stmt = select(Theme).where(Theme.name == canonical_name)
        theme = db.scalar(stmt)
        if theme is None:
            theme = Theme(name=canonical_name)
            db.add(theme)
            db.flush()
        if resolver_cache is not None:
            resolver_cache.themes[canonical_name] = theme
        themes.append(theme)

    return themes


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
    primary_relation = _get_primary_book_author_relations(book_authors)
    if primary_relation is None:
        return

    if country is not _UNSET:
        primary_relation.author.country = country
    if sex is not _UNSET:
        primary_relation.author.sex = sex


def _serialize_primary_author_country(book: Book) -> str | None:
    primary_relation = _get_primary_book_author(book)
    if primary_relation is None:
        return None

    if primary_relation.author.country is None:
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


def _get_primary_author(book: Book) -> Author | None:
    primary_relation = _get_primary_book_author(book)
    if primary_relation is None:
        return None

    return primary_relation.author


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


def _find_existing_book_by_identity(
    db: Session,
    data: BookCreate,
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> Book | None:
    author_inputs = _build_author_inputs(data)
    if not author_inputs or author_inputs[0].display_name is None:
        return None

    identity_key = _build_book_identity_cache_key(data)
    if resolver_cache is not None and identity_key is not None:
        cached_book = resolver_cache.books_by_identity.get(identity_key)
        if cached_book is not None:
            return cached_book

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
            if resolver_cache is not None and identity_key is not None:
                resolver_cache.books_by_identity[identity_key] = candidate
            return candidate

    return None


def _normalize_text_lookup_key(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip().casefold()
    return normalized or None


def _build_book_identity_cache_key(data: BookCreate) -> str | None:
    author_inputs = _build_author_inputs(data)
    if not author_inputs or author_inputs[0].display_name is None:
        return None

    normalized_title = normalize_author_lookup_key(data.title)
    normalized_author = normalize_author_lookup_key(author_inputs[0].display_name)
    if normalized_title is None or normalized_author is None:
        return None

    return f"{normalized_title}::{normalized_author}"


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
