from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import BookTheme
from app.models.book import Author
from app.models.book import Copy
from app.models.library import UserLibrary
from app.models.list import List
from app.models.list import ListBook
from app.models.enums import ListType
from app.schemas.list import ListCreate
from app.schemas.list import ListUpdate

DEFAULT_LIST_SEEDS: tuple[tuple[str, ListType], ...] = (
    ("Favoritos", ListType.WISHLIST),
    ("Pendientes", ListType.PENDING),
)

LIST_BOOK_LOAD_OPTIONS = (
    joinedload(ListBook.book).joinedload(Book.collection),
    joinedload(ListBook.book)
    .selectinload(Book.book_authors)
    .joinedload(BookAuthor.author)
    .joinedload(Author.country),
    joinedload(ListBook.book).selectinload(Book.book_themes).joinedload(BookTheme.theme),
)


class ListNotFoundError(ValueError):
    """Raised when the requested list does not exist."""


class DuplicateListBookError(ValueError):
    """Raised when adding the same book twice to a list."""


class ListBookNotFoundError(ValueError):
    """Raised when the requested book is not present in the list."""


class BookUnavailableForListError(ValueError):
    """Raised when the selected book cannot be added to a list."""


def create_default_lists_for_user(
    db: Session,
    *,
    user_id: int,
) -> None:
    for name, list_type in DEFAULT_LIST_SEEDS:
        db.add(
            List(
                user_id=user_id,
                name=name,
                type=list_type,
            ),
        )


def list_user_lists(
    db: Session,
    *,
    user_id: int,
) -> Sequence[tuple[List, int]]:
    stmt = (
        select(List, func.count(ListBook.list_id))
        .outerjoin(ListBook, ListBook.list_id == List.id)
        .where(List.user_id == user_id)
        .group_by(List.id)
        .order_by(List.created_at.asc(), List.id.asc())
    )
    return db.execute(stmt).all()


def create_list(
    db: Session,
    *,
    user_id: int,
    data: ListCreate,
) -> tuple[List, int]:
    list_obj = List(
        user_id=user_id,
        name=data.name,
        type=data.type,
    )
    db.add(list_obj)
    db.commit()
    db.refresh(list_obj)
    return list_obj, 0


def get_user_list(
    db: Session,
    *,
    user_id: int,
    list_id: int,
) -> List:
    stmt = select(List).where(List.id == list_id, List.user_id == user_id)
    list_obj = db.scalar(stmt)
    if list_obj is not None:
        return list_obj

    existing_list = db.get(List, list_id)
    if existing_list is None:
        raise ListNotFoundError("La lista no existe.")

    raise ListNotFoundError("La lista no existe o no pertenece al usuario autenticado.")


def update_list(
    db: Session,
    *,
    user_id: int,
    list_id: int,
    data: ListUpdate,
) -> tuple[List, int]:
    list_obj = get_user_list(db, user_id=user_id, list_id=list_id)

    list_obj.name = data.name
    list_obj.type = data.type
    db.commit()
    db.refresh(list_obj)
    return list_obj, get_list_book_count(db, list_id=list_obj.id)


def delete_list(
    db: Session,
    *,
    user_id: int,
    list_id: int,
) -> None:
    list_obj = get_user_list(db, user_id=user_id, list_id=list_id)
    db.delete(list_obj)
    db.commit()


def list_list_books(
    db: Session,
    *,
    user_id: int,
    list_id: int,
) -> Sequence[ListBook]:
    get_user_list(db, user_id=user_id, list_id=list_id)
    stmt = (
        select(ListBook)
        .join(List, List.id == ListBook.list_id)
        .options(*LIST_BOOK_LOAD_OPTIONS)
        .where(List.user_id == user_id, List.id == list_id)
        .order_by(ListBook.added_at.desc(), ListBook.book_id.asc())
    )
    return db.execute(stmt).unique().scalars().all()


def add_book_to_list(
    db: Session,
    *,
    user_id: int,
    list_id: int,
    book_id: int,
) -> None:
    get_user_list(db, user_id=user_id, list_id=list_id)
    _validate_book_for_list(db, user_id=user_id, book_id=book_id)

    existing_entry = db.scalar(
        select(ListBook).where(
            ListBook.list_id == list_id,
            ListBook.book_id == book_id,
        ),
    )
    if existing_entry is not None:
        raise DuplicateListBookError("El libro ya esta anadido a esta lista.")

    db.add(ListBook(list_id=list_id, book_id=book_id))
    db.commit()


def remove_book_from_list(
    db: Session,
    *,
    user_id: int,
    list_id: int,
    book_id: int,
) -> None:
    get_user_list(db, user_id=user_id, list_id=list_id)
    entry = db.scalar(
        select(ListBook).where(
            ListBook.list_id == list_id,
            ListBook.book_id == book_id,
        ),
    )
    if entry is None:
        raise ListBookNotFoundError("El libro no esta en la lista indicada.")

    db.delete(entry)
    db.commit()


def get_list_book_count(
    db: Session,
    *,
    list_id: int,
) -> int:
    count = db.scalar(
        select(func.count(ListBook.list_id)).where(ListBook.list_id == list_id),
    )
    return int(count or 0)


def _validate_book_for_list(
    db: Session,
    *,
    user_id: int,
    book_id: int,
) -> None:
    stmt = (
        select(Book.id)
        .join(Copy, Copy.book_id == Book.id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .where(
            Book.id == book_id,
            UserLibrary.user_id == user_id,
        )
        .distinct()
    )
    accessible_book_id = db.scalar(stmt)
    if accessible_book_id is None:
        raise BookUnavailableForListError(
            "El libro no esta disponible para el usuario autenticado.",
        )
