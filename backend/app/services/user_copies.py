from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import BookTheme
from app.models.book import Author
from app.models.book import Copy
from app.models.book import UserCopy
from app.models.enums import ReadingStatus
from app.models.library import Library
from app.models.library import UserLibrary
from app.schemas.user_copy import UserCopyOut
from app.schemas.user_copy import UserCopyUpdate
from app.services.libraries import get_user_library_membership


class CopyNotFoundError(ValueError):
    """Raised when the requested copy does not exist."""


class CopyPermissionDeniedError(ValueError):
    """Raised when the user cannot access the requested copy."""


COPY_ACCESS_LOAD_OPTIONS = (
    joinedload(Copy.book).joinedload(Book.collection),
    joinedload(Copy.book).joinedload(Book.publisher),
    joinedload(Copy.book)
    .selectinload(Book.book_authors)
    .joinedload(BookAuthor.author)
    .joinedload(Author.country),
    joinedload(Copy.book).selectinload(Book.book_themes).joinedload(BookTheme.theme),
)


def get_user_copy_data(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
) -> UserCopyOut:
    _get_accessible_copy(db, user_id=user_id, copy_id=copy_id)
    user_copy = _find_user_copy(db, user_id=user_id, copy_id=copy_id)
    if user_copy is None:
        return _serialize_default_user_copy(copy_id)
    return serialize_user_copy(user_copy)


def get_or_create_user_copy(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
    seed_reading_status: ReadingStatus = ReadingStatus.PENDING,
    seed_rating: int | None = None,
) -> UserCopy:
    copy = _get_accessible_copy(db, user_id=user_id, copy_id=copy_id)
    del copy

    user_copy = _find_user_copy(db, user_id=user_id, copy_id=copy_id)
    if user_copy is not None:
        return user_copy

    user_copy = UserCopy(
        user_id=user_id,
        copy_id=copy_id,
        reading_status=seed_reading_status,
        rating=seed_rating,
    )
    db.add(user_copy)
    db.flush()
    return user_copy


def update_user_copy_data(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
    data: UserCopyUpdate,
) -> UserCopyOut:
    user_copy = get_or_create_user_copy(db, user_id=user_id, copy_id=copy_id)

    previous_status = user_copy.reading_status

    if "reading_status" in data.model_fields_set:
        user_copy.reading_status = data.reading_status or ReadingStatus.PENDING
    if "rating" in data.model_fields_set:
        user_copy.rating = data.rating
    if "start_date" in data.model_fields_set:
        user_copy.start_date = data.start_date
    if "end_date" in data.model_fields_set:
        user_copy.end_date = data.end_date
    if "personal_notes" in data.model_fields_set:
        user_copy.personal_notes = data.personal_notes

    if (
        user_copy.reading_status == ReadingStatus.READING
        and previous_status != ReadingStatus.READING
        and "start_date" not in data.model_fields_set
        and user_copy.start_date is None
    ):
        user_copy.start_date = date.today()

    if (
        user_copy.reading_status == ReadingStatus.FINISHED
        and previous_status != ReadingStatus.FINISHED
        and "end_date" not in data.model_fields_set
        and user_copy.end_date is None
    ):
        user_copy.end_date = date.today()

    _synchronize_reading_status_with_dates(user_copy)

    if (
        user_copy.start_date is not None
        and user_copy.end_date is not None
        and user_copy.end_date < user_copy.start_date
    ):
        raise ValueError("La fecha de fin no puede ser anterior a la de inicio.")

    db.commit()
    db.refresh(user_copy)
    return serialize_user_copy(user_copy)


def serialize_user_copy(user_copy: UserCopy) -> UserCopyOut:
    return UserCopyOut(
        copy_id=user_copy.copy_id,
        reading_status=user_copy.reading_status,
        rating=user_copy.rating,
        start_date=user_copy.start_date,
        end_date=user_copy.end_date,
        personal_notes=user_copy.personal_notes,
    )


def _synchronize_reading_status_with_dates(user_copy: UserCopy) -> None:
    if user_copy.end_date is not None:
        user_copy.reading_status = ReadingStatus.FINISHED
        return

    if user_copy.start_date is not None:
        user_copy.reading_status = ReadingStatus.READING


def _find_user_copy(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
) -> UserCopy | None:
    return db.scalar(
        select(UserCopy).where(
            UserCopy.user_id == user_id,
            UserCopy.copy_id == copy_id,
        ),
    )


def _serialize_default_user_copy(copy_id: int) -> UserCopyOut:
    return UserCopyOut(
        copy_id=copy_id,
        reading_status=ReadingStatus.PENDING,
        rating=None,
        start_date=None,
        end_date=None,
        personal_notes=None,
    )


def _get_accessible_copy(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
) -> Copy:
    stmt = (
        select(Copy)
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .options(*COPY_ACCESS_LOAD_OPTIONS)
        .where(
            Copy.id == copy_id,
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        )
    )
    copy = db.execute(stmt).unique().scalar_one_or_none()
    if copy is not None:
        return copy

    existing_copy = db.get(Copy, copy_id)
    if existing_copy is None:
        raise CopyNotFoundError("El ejemplar solicitado no existe.")

    get_user_library_membership(
        db,
        user_id=user_id,
        library_id=existing_copy.library_id,
    )
    raise CopyPermissionDeniedError("No tienes permisos para acceder a este ejemplar.")
