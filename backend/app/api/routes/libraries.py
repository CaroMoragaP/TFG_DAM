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
from app.schemas.library import LibraryCreate
from app.schemas.library import LibraryMemberCreate
from app.schemas.library import LibraryMemberOut
from app.schemas.library import LibraryMemberUpdate
from app.schemas.library import LibraryOut
from app.schemas.library import LibraryUpdate
from app.services.libraries import LibraryArchivedError
from app.services.libraries import LibraryDeletionNotAllowedError
from app.services.libraries import LibraryMemberConflictError
from app.services.libraries import LibraryMemberNotFoundError
from app.services.libraries import LibraryMembershipOperationError
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryOwnershipRequiredError
from app.services.libraries import LibraryPermissionDeniedError
from app.services.libraries import add_library_member
from app.services.libraries import archive_library
from app.services.libraries import create_library as create_library_service
from app.services.libraries import delete_library as delete_library_service
from app.services.libraries import list_library_members
from app.services.libraries import list_user_libraries
from app.services.libraries import remove_library_member
from app.services.libraries import rename_library
from app.services.libraries import restore_library
from app.services.libraries import update_library_member_role

router = APIRouter()


@router.get(
    "/libraries",
    response_model=list[LibraryOut],
    summary="List the libraries available to the authenticated user",
)
def read_libraries(
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LibraryOut]:
    libraries = list_user_libraries(
        db,
        user_id=current_user.id,
        include_archived=include_archived,
    )
    return [
        build_library_response(library, role, member_count, copy_count)
        for library, role, member_count, copy_count in libraries
    ]


@router.post(
    "/libraries",
    response_model=LibraryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a library for the authenticated user",
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
    return build_library_response(library, role, member_count=1, copy_count=0)


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
    except (LibraryPermissionDeniedError, LibraryOwnershipRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return build_library_response(
        library,
        role,
        member_count=len(library.user_libraries),
        copy_count=len(library.copies),
    )


@router.get(
    "/libraries/{library_id}/members",
    response_model=list[LibraryMemberOut],
    summary="List members for a shared library",
)
def read_library_members(
    library_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LibraryMemberOut]:
    try:
        return [
            LibraryMemberOut(
                user_id=user.id,
                name=user.name,
                email=user.email,
                role=role,
            )
            for user, role in list_library_members(
                db,
                user_id=current_user.id,
                library_id=library_id,
            )
        ]
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (
        LibraryPermissionDeniedError,
        LibraryOwnershipRequiredError,
        LibraryMembershipOperationError,
    ) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.post(
    "/libraries/{library_id}/members",
    response_model=LibraryMemberOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a member to a shared library",
)
def create_library_member(
    library_id: int,
    payload: LibraryMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryMemberOut:
    try:
        user, role = add_library_member(
            db,
            user_id=current_user.id,
            library_id=library_id,
            email=str(payload.email),
            role=payload.role,
        )
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LibraryMemberNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (
        LibraryPermissionDeniedError,
        LibraryOwnershipRequiredError,
        LibraryMembershipOperationError,
    ) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except LibraryMemberConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return LibraryMemberOut(
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=role,
    )


@router.put(
    "/libraries/{library_id}/members/{member_user_id}",
    response_model=LibraryMemberOut,
    summary="Update a shared library member role",
)
def update_library_member(
    library_id: int,
    member_user_id: int,
    payload: LibraryMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryMemberOut:
    try:
        user, role = update_library_member_role(
            db,
            user_id=current_user.id,
            library_id=library_id,
            member_user_id=member_user_id,
            role=payload.role,
        )
    except (LibraryNotFoundError, LibraryMemberNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (
        LibraryPermissionDeniedError,
        LibraryOwnershipRequiredError,
        LibraryMembershipOperationError,
    ) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return LibraryMemberOut(
        user_id=user.id,
        name=user.name,
        email=user.email,
        role=role,
    )


@router.delete(
    "/libraries/{library_id}/members/{member_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from a shared library",
)
def delete_library_member(
    library_id: int,
    member_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        remove_library_member(
            db,
            user_id=current_user.id,
            library_id=library_id,
            member_user_id=member_user_id,
        )
    except (LibraryNotFoundError, LibraryMemberNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (
        LibraryPermissionDeniedError,
        LibraryOwnershipRequiredError,
        LibraryMembershipOperationError,
    ) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/libraries/{library_id}/archive",
    response_model=LibraryOut,
    summary="Archive a shared library",
)
def archive_library_entry(
    library_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryOut:
    try:
        library, role = archive_library(
            db,
            user_id=current_user.id,
            library_id=library_id,
        )
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (
        LibraryPermissionDeniedError,
        LibraryOwnershipRequiredError,
        LibraryMembershipOperationError,
    ) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return build_library_response(
        library,
        role,
        member_count=len(library.user_libraries),
        copy_count=len(library.copies),
    )


@router.post(
    "/libraries/{library_id}/restore",
    response_model=LibraryOut,
    summary="Restore a shared library",
)
def restore_library_entry(
    library_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryOut:
    try:
        library, role = restore_library(
            db,
            user_id=current_user.id,
            library_id=library_id,
        )
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (
        LibraryPermissionDeniedError,
        LibraryOwnershipRequiredError,
        LibraryMembershipOperationError,
    ) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return build_library_response(
        library,
        role,
        member_count=len(library.user_libraries),
        copy_count=len(library.copies),
    )


@router.delete(
    "/libraries/{library_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete a shared library",
)
def delete_library(
    library_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        delete_library_service(
            db,
            user_id=current_user.id,
            library_id=library_id,
        )
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (
        LibraryPermissionDeniedError,
        LibraryOwnershipRequiredError,
        LibraryMembershipOperationError,
    ) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryDeletionNotAllowedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


def build_library_response(
    library,
    role,
    member_count: int,
    copy_count: int,
) -> LibraryOut:
    return LibraryOut(
        id=library.id,
        name=library.name,
        type=library.type,
        created_at=library.created_at,
        role=role,
        is_archived=library.archived_at is not None,
        archived_at=library.archived_at,
        member_count=member_count,
        copy_count=copy_count,
    )
