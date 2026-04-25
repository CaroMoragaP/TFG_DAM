from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Response
from fastapi import status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.list import ListBookCreate
from app.schemas.list import ListBookSummary
from app.schemas.list import ListCreate
from app.schemas.list import ListOut
from app.schemas.list import ListUpdate
from app.services.lists import BookUnavailableForListError
from app.services.lists import DuplicateListBookError
from app.services.lists import ListBookNotFoundError
from app.services.lists import ListNotFoundError
from app.services.lists import add_book_to_list
from app.services.lists import create_list
from app.services.lists import delete_list
from app.services.lists import list_list_books
from app.services.lists import list_user_lists
from app.services.lists import remove_book_from_list
from app.services.lists import update_list

router = APIRouter()


@router.get(
    "/lists",
    response_model=list[ListOut],
    summary="List the personal lists of the authenticated user",
)
def read_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ListOut]:
    return [
        build_list_response(list_obj, book_count)
        for list_obj, book_count in list_user_lists(db, user_id=current_user.id)
    ]


@router.post(
    "/lists",
    response_model=ListOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new personal list",
)
def create_list_entry(
    payload: ListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ListOut:
    list_obj, book_count = create_list(db, user_id=current_user.id, data=payload)
    return build_list_response(list_obj, book_count)


@router.put(
    "/lists/{list_id}",
    response_model=ListOut,
    summary="Update a personal list",
)
def update_list_entry(
    list_id: int,
    payload: ListUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ListOut:
    try:
        list_obj, book_count = update_list(
            db,
            user_id=current_user.id,
            list_id=list_id,
            data=payload,
        )
    except ListNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return build_list_response(list_obj, book_count)


@router.delete(
    "/lists/{list_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a personal list",
)
def delete_list_entry(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        delete_list(db, user_id=current_user.id, list_id=list_id)
    except ListNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/lists/{list_id}/books",
    response_model=list[ListBookSummary],
    summary="List the books stored in a personal list",
)
def read_list_books(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ListBookSummary]:
    try:
        entries = list_list_books(db, user_id=current_user.id, list_id=list_id)
    except ListNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return [
        ListBookSummary(
            book_id=entry.book_id,
            title=entry.book.title,
            authors=[
                relation.author.name
                for relation in sorted(
                    entry.book.book_authors,
                    key=lambda item: item.author.name.casefold(),
                )
            ],
            genres=[
                relation.genre.name
                for relation in sorted(
                    entry.book.book_genres,
                    key=lambda item: item.genre.name.casefold(),
                )
            ],
            cover_url=entry.book.cover_url,
            publication_year=entry.book.publication_year,
            isbn=entry.book.isbn,
            added_at=entry.added_at,
        )
        for entry in entries
    ]


@router.post(
    "/lists/{list_id}/books",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Add a book to a personal list",
)
def create_list_book_entry(
    list_id: int,
    payload: ListBookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        add_book_to_list(
            db,
            user_id=current_user.id,
            list_id=list_id,
            book_id=payload.book_id,
        )
    except ListNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookUnavailableForListError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateListBookError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/lists/{list_id}/books/{book_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a book from a personal list",
)
def delete_list_book_entry(
    list_id: int,
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        remove_book_from_list(
            db,
            user_id=current_user.id,
            list_id=list_id,
            book_id=book_id,
        )
    except ListNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ListBookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


def build_list_response(list_obj, book_count: int) -> ListOut:
    return ListOut(
        id=list_obj.id,
        user_id=list_obj.user_id,
        name=list_obj.name,
        type=list_obj.type,
        created_at=list_obj.created_at,
        updated_at=list_obj.updated_at,
        book_count=book_count,
    )
