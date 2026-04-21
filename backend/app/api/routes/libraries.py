from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import status
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.library import LibraryCreate
from app.schemas.library import LibraryOut
from app.schemas.library import LibraryUpdate
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryOwnershipRequiredError
from app.services.libraries import LibraryPermissionDeniedError
from app.services.libraries import create_library as create_library_service
from app.services.libraries import list_user_libraries
from app.services.libraries import rename_library

router = APIRouter()


@router.get(
    "/libraries",
    response_model=list[LibraryOut],
    summary="List the libraries available to the authenticated user",
)
def read_libraries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LibraryOut]:
    libraries = list_user_libraries(db, user_id=current_user.id)
    return [build_library_response(library, role) for library, role in libraries]


@router.post(
    "/libraries",
    response_model=LibraryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a shared library for the authenticated user",
)
def create_library(
    payload: LibraryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryOut:
    library, role = create_library_service(
        db,
        user_id=current_user.id,
        name=payload.name,
        library_type=payload.type,
    )
    return build_library_response(library, role)


@router.put(
    "/libraries/{library_id}",
    response_model=LibraryOut,
    summary="Rename a library owned by the authenticated user",
)
def update_library(
    library_id: int,
    payload: LibraryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryOut:
    try:
        library, role = rename_library(
            db,
            user_id=current_user.id,
            library_id=library_id,
            name=payload.name,
        )
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LibraryPermissionDeniedError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryOwnershipRequiredError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return build_library_response(library, role)


def build_library_response(library, role) -> LibraryOut:
    return LibraryOut(
        id=library.id,
        name=library.name,
        type=library.type,
        created_at=library.created_at,
        role=role,
    )
