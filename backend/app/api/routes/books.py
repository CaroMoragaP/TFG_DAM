from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import Response
from fastapi import status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.enums import ReadingStatus
from app.schemas.book import BookCreate
from app.schemas.book import BookOut
from app.schemas.book import BookUpdate
from app.services.books import BookNotFoundError
from app.services.books import BookPermissionDeniedError
from app.services.books import DuplicateBookCopyError
from app.services.books import DuplicateBookIsbnError
from app.services.books import create_book
from app.services.books import delete_book
from app.services.books import get_book_copy
from app.services.books import list_genres
from app.services.books import list_books
from app.services.books import serialize_book_copy
from app.services.books import update_book
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryPermissionDeniedError

router = APIRouter()


@router.get(
    "/books",
    response_model=list[BookOut],
    summary="List catalog books for the authenticated user",
)
def read_books(
    library_id: int | None = Query(default=None),
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
            q=q,
            reading_status=reading_status,
            genre=genre,
            min_rating=min_rating,
        )
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LibraryPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

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
    except LibraryPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DuplicateBookCopyError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return serialize_book_copy(copy)


@router.get(
    "/books/{book_id}",
    response_model=BookOut,
    summary="Get a catalog book entry by copy id",
)
def read_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    try:
        copy = get_book_copy(db, user_id=current_user.id, copy_id=book_id)
    except BookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return serialize_book_copy(copy)


@router.put(
    "/books/{book_id}",
    response_model=BookOut,
    summary="Update a catalog book entry by copy id",
)
def update_book_entry(
    book_id: int,
    payload: BookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookOut:
    try:
        copy = update_book(
            db,
            user_id=current_user.id,
            copy_id=book_id,
            data=payload,
        )
    except BookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DuplicateBookIsbnError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return serialize_book_copy(copy)


@router.delete(
    "/books/{book_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a catalog book entry by copy id",
)
def delete_book_entry(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        delete_book(db, user_id=current_user.id, copy_id=book_id)
    except BookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
