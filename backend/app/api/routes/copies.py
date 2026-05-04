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
from app.schemas.book import CopyUpdate
from app.schemas.book import CopyDetailOut
from app.schemas.user_copy import UserCopyOut
from app.schemas.user_copy import UserCopyUpdate
from app.services.books import BookNotFoundError
from app.services.books import BookPermissionDeniedError
from app.services.books import get_book_copy
from app.services.books import serialize_copy_detail
from app.services.books import delete_copy as delete_copy_service
from app.services.books import update_copy as update_copy_service
from app.services.libraries import LibraryArchivedError
from app.services.libraries import LibraryOwnershipRequiredError
from app.services.libraries import LibraryRoleRequiredError
from app.services.social import LoanConflictError
from app.services.social import ReviewConflictError
from app.services.user_copies import CopyNotFoundError
from app.services.user_copies import CopyPermissionDeniedError
from app.services.user_copies import get_user_copy_data
from app.services.user_copies import update_user_copy_data

router = APIRouter()


@router.get(
    "/copies/{copy_id}",
    response_model=CopyDetailOut,
    summary="Get a copy detail by copy id",
)
def read_copy(
    copy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CopyDetailOut:
    try:
        copy = get_book_copy(db, user_id=current_user.id, copy_id=copy_id)
    except BookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return serialize_copy_detail(copy)


@router.put(
    "/copies/{copy_id}",
    response_model=CopyDetailOut,
    summary="Update a copy detail by copy id",
)
def update_copy(
    copy_id: int,
    payload: CopyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CopyDetailOut:
    try:
        copy = update_copy_service(
            db,
            user_id=current_user.id,
            copy_id=copy_id,
            data=payload,
        )
    except BookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except (LibraryOwnershipRequiredError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except LoanConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return serialize_copy_detail(copy)


@router.delete(
    "/copies/{copy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a copy by id",
)
def delete_copy(
    copy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        delete_copy_service(db, user_id=current_user.id, copy_id=copy_id)
    except BookNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except (LibraryOwnershipRequiredError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/copies/{copy_id}/user-data",
    response_model=UserCopyOut,
    summary="Get user-specific copy data for the authenticated user",
)
def read_copy_user_data(
    copy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserCopyOut:
    try:
        return get_user_copy_data(db, user_id=current_user.id, copy_id=copy_id)
    except CopyNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CopyPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.put(
    "/copies/{copy_id}/user-data",
    response_model=UserCopyOut,
    summary="Update user-specific copy data for the authenticated user",
)
def update_copy_user_data(
    copy_id: int,
    payload: UserCopyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserCopyOut:
    try:
        return update_user_copy_data(
            db,
            user_id=current_user.id,
            copy_id=copy_id,
            data=payload,
        )
    except CopyNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CopyPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ReviewConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
