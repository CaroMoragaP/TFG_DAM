from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.enums import ReadingStatus
from app.schemas.book import BookCreate
from app.schemas.book import BookMetadataOut
from app.schemas.book import BookMetadataUpdate
from app.schemas.book import BookOut
from app.services.books import DuplicateBookCopyError
from app.services.books import DuplicateBookIsbnError
from app.services.books import create_book
from app.services.books import list_genres
from app.services.books import list_books
from app.services.books import serialize_book_metadata
from app.services.books import serialize_book_copy
from app.services.books import update_book_metadata
from app.services.books import BookNotFoundError
from app.services.books import BookPermissionDeniedError
from app.services.libraries import LibraryArchivedError
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryOwnershipRequiredError
from app.services.libraries import LibraryPermissionDeniedError
from app.services.libraries import LibraryRoleRequiredError
from app.services.lists import ListNotFoundError

router = APIRouter()


@router.get(
    "/books",
    response_model=list[BookOut],
    summary="List catalog books for the authenticated user",
)
def read_books(
    library_id: int | None = Query(default=None),
    list_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    reading_status: ReadingStatus | None = Query(default=None),
    genre: str | None = Query(default=None),
    min_rating: int | None = Query(default=None, ge=1, le=5),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BookOut]:
    try:
        copies = list_books(
            db,
            user_id=current_user.id,
            library_id=library_id,
            list_id=list_id,
            q=q,
            reading_status=reading_status,
            genre=genre,
            min_rating=min_rating,
        )
    except ListNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return [serialize_book_copy(copy) for copy in copies]


@router.get(
    "/genres",
    response_model=list[str],
    summary="List catalog genres",
)
def read_genres(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    del current_user
    return list_genres(db)


@router.post(
    "/books",
    response_model=BookOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new catalog book entry in a library",
)
def create_book_entry(
    payload: BookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    try:
        copy = create_book(db, user_id=current_user.id, data=payload)
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except DuplicateBookCopyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return serialize_book_copy(copy)


@router.put(
    "/books/{book_id}/metadata",
    response_model=BookMetadataOut,
    summary="Update canonical metadata for a book",
)
def update_book_metadata_entry(
    book_id: int,
    payload: BookMetadataUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookMetadataOut:
    try:
        book = update_book_metadata(
            db,
            user_id=current_user.id,
            book_id=book_id,
            data=payload,
        )
    except BookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryOwnershipRequiredError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except DuplicateBookIsbnError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return serialize_book_metadata(book)
