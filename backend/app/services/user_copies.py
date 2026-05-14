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
from app.services.social import record_user_copy_reading_event
from app.services.social import sync_public_review_rating


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
    has_reading_status = "reading_status" in data.model_fields_set
    has_start_date = "start_date" in data.model_fields_set
    has_end_date = "end_date" in data.model_fields_set

    if "rating" in data.model_fields_set:
        user_copy.rating = data.rating
    if "personal_notes" in data.model_fields_set:
        user_copy.personal_notes = data.personal_notes

    (
        user_copy.reading_status,
        user_copy.start_date,
        user_copy.end_date,
    ) = _normalize_reading_progress(
        previous_status=previous_status,
        previous_start_date=user_copy.start_date,
        previous_end_date=user_copy.end_date,
        has_reading_status=has_reading_status,
        requested_reading_status=data.reading_status,
        has_start_date=has_start_date,
        requested_start_date=data.start_date,
        has_end_date=has_end_date,
        requested_end_date=data.end_date,
    )

    if "rating" in data.model_fields_set:
        sync_public_review_rating(
            db,
            user_id=user_id,
            copy_id=copy_id,
            rating=user_copy.rating,
        )

    record_user_copy_reading_event(
        db,
        user_copy_id=user_copy.id,
        previous_status=previous_status,
    )
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


def _normalize_reading_progress(
    *,
    previous_status: ReadingStatus,
    previous_start_date: date | None,
    previous_end_date: date | None,
    has_reading_status: bool,
    requested_reading_status: ReadingStatus | None,
    has_start_date: bool,
    requested_start_date: date | None,
    has_end_date: bool,
    requested_end_date: date | None,
) -> tuple[ReadingStatus, date | None, date | None]:
    next_status = (
        requested_reading_status or ReadingStatus.PENDING
        if has_reading_status
        else previous_status
    )
    next_start_date = requested_start_date if has_start_date else previous_start_date
    next_end_date = requested_end_date if has_end_date else previous_end_date

    is_reread_request = (
        has_start_date
        and requested_start_date is not None
        and previous_end_date is not None
        and not has_end_date
        and (
            not has_reading_status
            or next_status == ReadingStatus.READING
        )
    )
    if is_reread_request:
        next_end_date = None

    if has_reading_status:
        if next_status == ReadingStatus.PENDING:
            next_start_date = None
            next_end_date = None
        elif next_status == ReadingStatus.READING:
            if next_start_date is None:
                next_start_date = date.today()
            next_end_date = None
        elif next_status == ReadingStatus.FINISHED and next_end_date is None:
            next_end_date = date.today()

    if next_end_date is not None and next_start_date is not None and next_end_date < next_start_date:
        raise ValueError("La fecha de fin no puede ser anterior a la de inicio.")

    if next_end_date is not None:
        return ReadingStatus.FINISHED, next_start_date, next_end_date
    if next_start_date is not None:
        return ReadingStatus.READING, next_start_date, next_end_date
    return ReadingStatus.PENDING, next_start_date, next_end_date


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
