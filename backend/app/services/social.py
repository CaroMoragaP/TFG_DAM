from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from datetime import timezone

from sqlalchemy import and_
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import selectinload

from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import Copy
from app.models.book import UserCopy
from app.models.enums import CopyStatus
from app.models.enums import LibraryEventType
from app.models.enums import LibraryType
from app.models.enums import ReadingStatus
from app.models.library import Library
from app.models.library import UserLibrary
from app.models.social import CopyLoan
from app.models.social import LibraryEvent
from app.models.social import Review
from app.models.user import User
from app.schemas.social import CopyCommunityOut
from app.schemas.social import CopyLoanCreate
from app.schemas.social import CopyLoanOut
from app.schemas.social import LibraryActivityPageOut
from app.schemas.social import LibraryEventOut
from app.schemas.social import LibraryReviewCardOut
from app.schemas.social import LibraryReviewFilter
from app.schemas.social import LibraryReviewsPageOut
from app.schemas.social import LibraryReviewSort
from app.schemas.social import ReaderPreviewOut
from app.schemas.social import ReviewCreate
from app.schemas.social import ReviewOut
from app.schemas.social import ReviewUpdate
from app.services.libraries import CATALOG_MANAGEMENT_ROLES
from app.services.libraries import READ_ACCESS_ROLES
from app.services.libraries import LibraryArchivedError
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryPermissionDeniedError
from app.services.libraries import get_accessible_library
from app.services.libraries import get_user_library_membership


class CommunityFeatureUnavailableError(ValueError):
    """Raised when a community feature is requested for a personal library."""


class ReviewNotFoundError(ValueError):
    """Raised when the requested review does not exist."""


class ReviewConflictError(ValueError):
    """Raised when a public review would violate uniqueness rules."""


class ReviewPermissionDeniedError(ValueError):
    """Raised when the user cannot edit or delete the requested review."""


class LoanNotFoundError(ValueError):
    """Raised when the requested loan does not exist."""


class LoanConflictError(ValueError):
    """Raised when the requested loan operation is not valid."""


class LoanValidationError(ValueError):
    """Raised when the requested loan payload is invalid."""


def attach_copy_social_summaries(
    db: Session,
    copies: Sequence[Copy],
    *,
    preview_limit: int = 3,
) -> None:
    if not copies:
        return

    for copy in copies:
        setattr(copy, "_social_active_loan", None)
        setattr(copy, "_social_shared_readers_preview", [])
        setattr(copy, "_social_shared_readers_count", 0)
        setattr(copy, "_social_public_review_count", 0)
        setattr(copy, "_social_public_average_rating", None)

    shared_copies = [copy for copy in copies if copy.library.type == LibraryType.SHARED]
    if not shared_copies:
        return

    shared_copy_ids = [copy.id for copy in shared_copies]
    copy_by_id = {copy.id: copy for copy in shared_copies}

    for loan in _list_active_loans_for_copy_ids(db, shared_copy_ids):
        setattr(copy_by_id[loan.copy_id], "_social_active_loan", serialize_copy_loan(loan))

    for copy_id, review_count, average_rating in db.execute(
        select(
            Review.copy_id,
            func.count(Review.id),
            func.avg(Review.rating),
        )
        .where(Review.copy_id.in_(shared_copy_ids))
        .group_by(Review.copy_id),
    ).all():
        copy = copy_by_id[copy_id]
        setattr(copy, "_social_public_review_count", int(review_count))
        setattr(copy, "_social_public_average_rating", _round_rating(average_rating))

    readers_by_copy = _list_shared_readers_by_copy(db, shared_copy_ids)
    for copy_id, readers in readers_by_copy.items():
        copy = copy_by_id[copy_id]
        setattr(copy, "_social_shared_readers_count", len(readers))
        setattr(copy, "_social_shared_readers_preview", readers[:preview_limit])


def list_library_activity(
    db: Session,
    *,
    user_id: int,
    library_id: int,
    limit: int,
    offset: int,
) -> LibraryActivityPageOut:
    library = _get_shared_library(db, user_id=user_id, library_id=library_id)

    total = int(
        db.scalar(
            select(func.count(LibraryEvent.id)).where(LibraryEvent.library_id == library.id),
        )
        or 0,
    )
    events = db.execute(
        select(LibraryEvent)
        .options(joinedload(LibraryEvent.actor_user))
        .where(LibraryEvent.library_id == library.id)
        .order_by(LibraryEvent.created_at.desc(), LibraryEvent.id.desc())
        .offset(offset)
        .limit(limit),
    ).scalars().all()

    return LibraryActivityPageOut(
        items=[serialize_library_event(event) for event in events],
        total=total,
        limit=limit,
        offset=offset,
    )


def list_library_reviews(
    db: Session,
    *,
    user_id: int,
    library_id: int,
    filter_by: LibraryReviewFilter,
    sort_by: LibraryReviewSort,
    limit: int,
    offset: int,
) -> LibraryReviewsPageOut:
    library = _get_shared_library(db, user_id=user_id, library_id=library_id)
    reviews = db.execute(
        select(Review)
        .options(
            joinedload(Review.user),
            joinedload(Review.copy).joinedload(Copy.book),
            joinedload(Review.copy)
            .joinedload(Copy.book)
            .selectinload(Book.book_authors)
            .joinedload(BookAuthor.author),
        )
        .join(Copy, Copy.id == Review.copy_id)
        .where(Copy.library_id == library.id)
        .order_by(Review.updated_at.desc(), Review.id.desc()),
    ).unique().scalars().all()

    cards_by_copy: dict[int, dict[str, object]] = {}
    for review in reviews:
        copy = review.copy
        book = copy.book
        card = cards_by_copy.setdefault(
            copy.id,
            {
                "copy_id": copy.id,
                "book_id": book.id,
                "title": book.title,
                "authors": _serialize_book_authors(book),
                "cover_url": book.cover_url,
                "reviews": [],
            },
        )
        card["reviews"].append(review)

    cards: list[LibraryReviewCardOut] = []
    for card_data in cards_by_copy.values():
        review_items = card_data["reviews"]
        if not isinstance(review_items, list) or not review_items:
            continue

        my_review = next((item for item in review_items if item.user_id == user_id), None)
        other_reviews = [item for item in review_items if item.user_id != user_id]
        if filter_by == "missing_mine" and my_review is not None:
            continue
        if filter_by == "mine" and my_review is None:
            continue

        ratings = [item.rating for item in review_items]
        last_reviewed_at = max(item.updated_at for item in review_items)
        cards.append(
            LibraryReviewCardOut(
                copy_id=int(card_data["copy_id"]),
                book_id=int(card_data["book_id"]),
                title=str(card_data["title"]),
                authors=list(card_data["authors"]),
                cover_url=card_data["cover_url"],
                public_review_count=len(review_items),
                public_average_rating=_round_rating(sum(ratings) / len(ratings)),
                last_reviewed_at=last_reviewed_at,
                my_review=serialize_review(my_review) if my_review is not None else None,
                other_reviews=[serialize_review(item) for item in other_reviews[:3]],
            ),
        )

    cards.sort(key=lambda item: _library_review_sort_key(item, sort_by))
    total = len(cards)
    paginated_items = cards[offset : offset + limit]
    return LibraryReviewsPageOut(
        items=paginated_items,
        total=total,
        limit=limit,
        offset=offset,
    )


def get_copy_community(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
) -> CopyCommunityOut:
    copy = _get_shared_copy(db, user_id=user_id, copy_id=copy_id)
    attach_copy_social_summaries(db, [copy])
    shared_readers = _list_shared_readers_by_copy(db, [copy.id]).get(copy.id, [])
    latest_reviews = db.execute(
        select(Review)
        .options(joinedload(Review.user))
        .where(Review.copy_id == copy.id)
        .order_by(Review.updated_at.desc(), Review.id.desc())
        .limit(5),
    ).scalars().all()

    return CopyCommunityOut(
        copy_id=copy.id,
        active_loan=getattr(copy, "_social_active_loan", None),
        shared_readers=shared_readers,
        shared_readers_count=len(shared_readers),
        public_review_count=getattr(copy, "_social_public_review_count", 0),
        public_average_rating=getattr(copy, "_social_public_average_rating", None),
        latest_reviews=[serialize_review(review) for review in latest_reviews],
    )


def list_copy_reviews(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
) -> list[ReviewOut]:
    copy = _get_shared_copy(db, user_id=user_id, copy_id=copy_id)
    reviews = db.execute(
        select(Review)
        .options(joinedload(Review.user))
        .where(Review.copy_id == copy.id)
        .order_by(Review.updated_at.desc(), Review.id.desc()),
    ).scalars().all()
    return [serialize_review(review) for review in reviews]


def create_review(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
    data: ReviewCreate,
) -> ReviewOut:
    copy = _get_shared_copy(db, user_id=user_id, copy_id=copy_id)
    existing_review = db.scalar(
        select(Review).where(
            Review.user_id == user_id,
            Review.copy_id == copy.id,
        ),
    )
    if existing_review is not None:
        raise ReviewConflictError("Ya has publicado una resena publica para este ejemplar.")

    from app.services.user_copies import get_or_create_user_copy

    user_copy = get_or_create_user_copy(db, user_id=user_id, copy_id=copy.id)
    if user_copy.rating is None:
        raise ReviewConflictError(
            "Debes guardar una valoracion antes de publicar una resena publica.",
        )

    review = Review(
        copy_id=copy.id,
        user_id=user_id,
        rating=user_copy.rating,
        body=data.body,
    )
    db.add(review)
    db.flush()

    _create_library_event(
        db,
        library_id=copy.library_id,
        actor_user_id=user_id,
        copy_id=copy.id,
        review_id=review.id,
        loan_id=None,
        event_type=LibraryEventType.REVIEW_PUBLISHED,
        payload_json={
            "book_title": copy.book.title,
            "copy_id": copy.id,
            "rating": review.rating,
            "body": review.body,
        },
    )

    db.commit()
    db.refresh(review)
    db.refresh(review, attribute_names=["user"])
    return serialize_review(review)


def update_review(
    db: Session,
    *,
    user_id: int,
    review_id: int,
    data: ReviewUpdate,
) -> ReviewOut:
    review = _get_shared_review(db, user_id=user_id, review_id=review_id)
    if review.user_id != user_id:
        raise ReviewPermissionDeniedError("Solo puedes editar tu propia resena publica.")

    if "body" in data.model_fields_set:
        review.body = data.body

    db.flush()
    _create_library_event(
        db,
        library_id=review.copy.library_id,
        actor_user_id=user_id,
        copy_id=review.copy_id,
        review_id=review.id,
        loan_id=None,
        event_type=LibraryEventType.REVIEW_UPDATED,
        payload_json={
            "book_title": review.copy.book.title,
            "copy_id": review.copy_id,
            "rating": review.rating,
            "body": review.body,
        },
    )
    db.commit()
    db.refresh(review)
    return serialize_review(review)


def delete_review(
    db: Session,
    *,
    user_id: int,
    review_id: int,
) -> None:
    review = _get_shared_review(db, user_id=user_id, review_id=review_id)
    if review.user_id != user_id:
        raise ReviewPermissionDeniedError("Solo puedes borrar tu propia resena publica.")

    db.delete(review)
    db.commit()


def list_copy_loans(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
) -> list[CopyLoanOut]:
    copy = _get_shared_copy(db, user_id=user_id, copy_id=copy_id)
    loans = db.execute(
        select(CopyLoan)
        .options(
            joinedload(CopyLoan.lender_user),
            joinedload(CopyLoan.borrower_user),
        )
        .where(CopyLoan.copy_id == copy.id)
        .order_by(CopyLoan.loaned_at.desc(), CopyLoan.id.desc()),
    ).scalars().all()
    return [serialize_copy_loan(loan) for loan in loans]


def create_copy_loan(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
    data: CopyLoanCreate,
) -> CopyLoanOut:
    copy = _get_shared_copy(
        db,
        user_id=user_id,
        copy_id=copy_id,
        allowed_roles=CATALOG_MANAGEMENT_ROLES,
    )
    _assert_no_active_loan(db, copy_id=copy.id)

    borrower_user = None
    borrower_name = data.borrower_name
    if data.borrower_user_id is not None:
        borrower_user = _get_internal_borrower(
            db,
            library_id=copy.library_id,
            borrower_user_id=data.borrower_user_id,
        )
        borrower_name = borrower_user.name

    loan = CopyLoan(
        copy_id=copy.id,
        lender_user_id=user_id,
        borrower_user_id=borrower_user.id if borrower_user is not None else None,
        borrower_name=borrower_name,
        due_date=data.due_date,
        notes=data.notes,
        loaned_at=datetime.now(timezone.utc),
    )
    db.add(loan)
    copy.status = CopyStatus.LOANED
    db.flush()

    _create_library_event(
        db,
        library_id=copy.library_id,
        actor_user_id=user_id,
        copy_id=copy.id,
        review_id=None,
        loan_id=loan.id,
        event_type=LibraryEventType.LOAN_STARTED,
        payload_json={
            "book_title": copy.book.title,
            "copy_id": copy.id,
            "borrower_name": borrower_name,
            "borrower_user_id": borrower_user.id if borrower_user is not None else None,
            "due_date": data.due_date.isoformat() if data.due_date is not None else None,
        },
    )

    db.commit()
    db.refresh(loan)
    return serialize_copy_loan(loan)


def return_copy_loan(
    db: Session,
    *,
    user_id: int,
    loan_id: int,
) -> CopyLoanOut:
    loan = _get_shared_loan(
        db,
        user_id=user_id,
        loan_id=loan_id,
        allowed_roles=CATALOG_MANAGEMENT_ROLES,
    )
    if loan.returned_at is not None:
        raise LoanConflictError("Este prestamo ya fue devuelto.")

    loan.returned_at = datetime.now(timezone.utc)
    loan.copy.status = CopyStatus.AVAILABLE
    db.flush()

    _create_library_event(
        db,
        library_id=loan.copy.library_id,
        actor_user_id=user_id,
        copy_id=loan.copy_id,
        review_id=None,
        loan_id=loan.id,
        event_type=LibraryEventType.LOAN_RETURNED,
        payload_json={
            "book_title": loan.copy.book.title,
            "copy_id": loan.copy_id,
            "borrower_name": _resolve_borrower_name(loan),
        },
    )

    db.commit()
    db.refresh(loan)
    return serialize_copy_loan(loan)


def validate_copy_status_update(db: Session, *, copy_id: int, status: CopyStatus | None) -> None:
    if status is None:
        return
    if status == CopyStatus.LOANED:
        return

    active_loan = db.scalar(
        select(CopyLoan.id).where(
            CopyLoan.copy_id == copy_id,
            CopyLoan.returned_at.is_(None),
        ),
    )
    if active_loan is not None:
        raise LoanConflictError(
            "No puedes cambiar el estado compartido mientras exista un prestamo activo.",
        )


def record_user_copy_reading_event(
    db: Session,
    *,
    user_copy_id: int,
    previous_status: ReadingStatus,
) -> None:
    user_copy = db.execute(
        select(UserCopy)
        .options(
            joinedload(UserCopy.user),
            joinedload(UserCopy.copy).joinedload(Copy.book),
            joinedload(UserCopy.copy).joinedload(Copy.library),
        )
        .where(UserCopy.id == user_copy_id),
    ).scalar_one()

    current_status = user_copy.reading_status
    if current_status == previous_status:
        return
    if user_copy.copy.library.type != LibraryType.SHARED:
        return

    event_type = None
    if current_status == ReadingStatus.READING:
        event_type = LibraryEventType.READING_STARTED
    elif current_status == ReadingStatus.FINISHED:
        event_type = LibraryEventType.READING_FINISHED

    if event_type is None:
        return

    _create_library_event(
        db,
        library_id=user_copy.copy.library_id,
        actor_user_id=user_copy.user_id,
        copy_id=user_copy.copy_id,
        review_id=None,
        loan_id=None,
        event_type=event_type,
        payload_json={
            "book_title": user_copy.copy.book.title,
            "copy_id": user_copy.copy_id,
            "reading_status": current_status.value,
        },
    )


def sync_public_review_rating(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
    rating: int | None,
) -> None:
    review = db.scalar(
        select(Review)
        .options(
            joinedload(Review.copy).joinedload(Copy.book),
        )
        .where(
            Review.user_id == user_id,
            Review.copy_id == copy_id,
        ),
    )
    if review is None:
        return
    if rating is None:
        raise ReviewConflictError(
            "No puedes quitar la valoracion mientras tu resena publica siga publicada.",
        )
    if review.rating == rating:
        return

    review.rating = rating
    db.flush()
    _create_library_event(
        db,
        library_id=review.copy.library_id,
        actor_user_id=user_id,
        copy_id=review.copy_id,
        review_id=review.id,
        loan_id=None,
        event_type=LibraryEventType.REVIEW_UPDATED,
        payload_json={
            "book_title": review.copy.book.title,
            "copy_id": review.copy_id,
            "rating": review.rating,
            "body": review.body,
        },
    )


def record_book_added_event(
    db: Session,
    *,
    library: Library,
    actor_user_id: int,
    copy: Copy,
) -> None:
    if library.type != LibraryType.SHARED:
        return

    _create_library_event(
        db,
        library_id=library.id,
        actor_user_id=actor_user_id,
        copy_id=copy.id,
        review_id=None,
        loan_id=None,
        event_type=LibraryEventType.BOOK_ADDED,
        payload_json={
            "book_title": copy.book.title,
            "copy_id": copy.id,
        },
    )


def record_books_imported_event(
    db: Session,
    *,
    library: Library,
    actor_user_id: int,
    imported_count: int,
    sample_titles: list[str],
) -> None:
    if library.type != LibraryType.SHARED or imported_count <= 0:
        return

    _create_library_event(
        db,
        library_id=library.id,
        actor_user_id=actor_user_id,
        copy_id=None,
        review_id=None,
        loan_id=None,
        event_type=LibraryEventType.BOOKS_IMPORTED,
        payload_json={
            "imported_count": imported_count,
            "sample_titles": sample_titles[:3],
        },
    )


def serialize_copy_loan(loan: CopyLoan) -> CopyLoanOut:
    borrower_name = _resolve_borrower_name(loan)
    return CopyLoanOut(
        id=loan.id,
        copy_id=loan.copy_id,
        lender_user_id=loan.lender_user_id,
        lender_name=loan.lender_user.name,
        borrower_user_id=loan.borrower_user_id,
        borrower_name=borrower_name,
        is_internal=loan.borrower_user_id is not None,
        loaned_at=loan.loaned_at,
        due_date=loan.due_date,
        returned_at=loan.returned_at,
        notes=loan.notes,
    )


def serialize_review(review: Review) -> ReviewOut:
    return ReviewOut(
        id=review.id,
        copy_id=review.copy_id,
        user_id=review.user_id,
        user_name=review.user.name,
        rating=review.rating,
        body=review.body,
        created_at=review.created_at,
        updated_at=review.updated_at,
    )


def serialize_library_event(event: LibraryEvent) -> LibraryEventOut:
    return LibraryEventOut(
        id=event.id,
        library_id=event.library_id,
        actor_user_id=event.actor_user_id,
        actor_name=event.actor_user.name,
        copy_id=event.copy_id,
        review_id=event.review_id,
        loan_id=event.loan_id,
        event_type=event.event_type,
        created_at=event.created_at,
        payload_json=event.payload_json,
    )


def _get_shared_library(db: Session, *, user_id: int, library_id: int) -> Library:
    library = get_accessible_library(
        db,
        user_id=user_id,
        library_id=library_id,
        allowed_roles=READ_ACCESS_ROLES,
    )
    _assert_shared_library(library)
    return library


def _get_shared_copy(
    db: Session,
    *,
    user_id: int,
    copy_id: int,
    allowed_roles=frozenset(READ_ACCESS_ROLES),
) -> Copy:
    copy = db.execute(
        select(Copy)
        .options(
            joinedload(Copy.book),
            joinedload(Copy.library),
        )
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .where(
            Copy.id == copy_id,
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        ),
    ).unique().scalar_one_or_none()
    if copy is not None:
        get_user_library_membership(
            db,
            user_id=user_id,
            library_id=copy.library_id,
            allowed_roles=allowed_roles,
        )
        _assert_shared_library(copy.library)
        return copy

    existing_copy = db.get(Copy, copy_id)
    if existing_copy is None:
        raise LibraryNotFoundError("El ejemplar solicitado no existe.")

    get_user_library_membership(
        db,
        user_id=user_id,
        library_id=existing_copy.library_id,
        allowed_roles=allowed_roles,
    )
    raise LibraryPermissionDeniedError("No tienes permisos para acceder a este ejemplar.")


def _get_shared_review(
    db: Session,
    *,
    user_id: int,
    review_id: int,
) -> Review:
    review = db.execute(
        select(Review)
        .options(
            joinedload(Review.user),
            joinedload(Review.copy).joinedload(Copy.book),
            joinedload(Review.copy).joinedload(Copy.library),
        )
        .where(Review.id == review_id),
    ).scalar_one_or_none()
    if review is None:
        raise ReviewNotFoundError("La resena solicitada no existe.")

    get_user_library_membership(
        db,
        user_id=user_id,
        library_id=review.copy.library_id,
        allowed_roles=READ_ACCESS_ROLES,
    )
    _assert_shared_library(review.copy.library)
    return review


def _get_shared_loan(
    db: Session,
    *,
    user_id: int,
    loan_id: int,
    allowed_roles=frozenset(READ_ACCESS_ROLES),
) -> CopyLoan:
    loan = db.execute(
        select(CopyLoan)
        .options(
            joinedload(CopyLoan.lender_user),
            joinedload(CopyLoan.borrower_user),
            joinedload(CopyLoan.copy).joinedload(Copy.book),
            joinedload(CopyLoan.copy).joinedload(Copy.library),
        )
        .where(CopyLoan.id == loan_id),
    ).scalar_one_or_none()
    if loan is None:
        raise LoanNotFoundError("El prestamo solicitado no existe.")

    get_user_library_membership(
        db,
        user_id=user_id,
        library_id=loan.copy.library_id,
        allowed_roles=allowed_roles,
    )
    _assert_shared_library(loan.copy.library)
    return loan


def _assert_shared_library(library: Library) -> None:
    if library.type != LibraryType.SHARED:
        raise CommunityFeatureUnavailableError(
            "Esta funcionalidad solo esta disponible en bibliotecas compartidas.",
        )


def _assert_no_active_loan(db: Session, *, copy_id: int) -> None:
    active_loan = db.scalar(
        select(CopyLoan.id).where(
            CopyLoan.copy_id == copy_id,
            CopyLoan.returned_at.is_(None),
        ),
    )
    if active_loan is not None:
        raise LoanConflictError("Ya existe un prestamo activo para este ejemplar.")


def _get_internal_borrower(
    db: Session,
    *,
    library_id: int,
    borrower_user_id: int,
) -> User:
    borrower = db.execute(
        select(User)
        .join(UserLibrary, UserLibrary.user_id == User.id)
        .where(
            User.id == borrower_user_id,
            UserLibrary.library_id == library_id,
        ),
    ).scalar_one_or_none()
    if borrower is None:
        raise LoanValidationError(
            "El borrower_user_id debe pertenecer a la biblioteca compartida.",
        )
    return borrower


def _list_active_loans_for_copy_ids(db: Session, copy_ids: list[int]) -> list[CopyLoan]:
    return db.execute(
        select(CopyLoan)
        .options(
            joinedload(CopyLoan.lender_user),
            joinedload(CopyLoan.borrower_user),
        )
        .where(
            CopyLoan.copy_id.in_(copy_ids),
            CopyLoan.returned_at.is_(None),
        ),
    ).scalars().all()


def _list_shared_readers_by_copy(
    db: Session,
    copy_ids: list[int],
) -> dict[int, list[ReaderPreviewOut]]:
    rows = db.execute(
        select(
            UserCopy.copy_id,
            User.id,
            User.name,
        )
        .join(User, User.id == UserCopy.user_id)
        .join(Copy, Copy.id == UserCopy.copy_id)
        .join(
            UserLibrary,
            and_(
                UserLibrary.user_id == UserCopy.user_id,
                UserLibrary.library_id == Copy.library_id,
            ),
        )
        .where(
            UserCopy.copy_id.in_(copy_ids),
            UserCopy.reading_status == ReadingStatus.READING,
        )
        .order_by(UserCopy.copy_id.asc(), User.name.asc(), User.id.asc()),
    ).all()

    readers_by_copy: dict[int, list[ReaderPreviewOut]] = {copy_id: [] for copy_id in copy_ids}
    for copy_id, user_id, name in rows:
        readers_by_copy[copy_id].append(ReaderPreviewOut(user_id=user_id, name=name))
    return readers_by_copy


def _create_library_event(
    db: Session,
    *,
    library_id: int,
    actor_user_id: int,
    copy_id: int | None,
    review_id: int | None,
    loan_id: int | None,
    event_type: LibraryEventType,
    payload_json: dict[str, object],
) -> None:
    db.add(
        LibraryEvent(
            library_id=library_id,
            actor_user_id=actor_user_id,
            copy_id=copy_id,
            review_id=review_id,
            loan_id=loan_id,
            event_type=event_type,
            payload_json=payload_json,
        ),
    )


def _resolve_borrower_name(loan: CopyLoan) -> str:
    if loan.borrower_user is not None:
        return loan.borrower_user.name
    if loan.borrower_name is not None:
        return loan.borrower_name
    return "Prestatario desconocido"


def _round_rating(value: object) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _serialize_book_authors(book: Book) -> list[str]:
    return [
        relation.author.display_name
        for relation in sorted(
            book.book_authors,
            key=lambda item: item.author.display_name.casefold(),
        )
    ]


def _library_review_sort_key(
    card: LibraryReviewCardOut,
    sort_by: LibraryReviewSort,
) -> tuple[object, ...]:
    if sort_by == "rating":
        return (
            -(card.public_average_rating or 0),
            -card.public_review_count,
            -card.last_reviewed_at.timestamp(),
            card.title.casefold(),
        )
    if sort_by == "count":
        return (
            -card.public_review_count,
            -(card.public_average_rating or 0),
            -card.last_reviewed_at.timestamp(),
            card.title.casefold(),
        )
    return (
        -card.last_reviewed_at.timestamp(),
        -card.public_review_count,
        card.title.casefold(),
    )
