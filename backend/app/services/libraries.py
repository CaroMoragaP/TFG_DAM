from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import LibraryType
from app.models.enums import UserLibraryRole
from app.models.library import Library
from app.models.library import UserLibrary
from app.models.user import User

DEFAULT_PERSONAL_LIBRARY_NAME = "Biblioteca personal"


class LibraryNotFoundError(ValueError):
    """Raised when the requested library does not exist."""


class LibraryPermissionDeniedError(ValueError):
    """Raised when the user cannot access the requested library."""


class LibraryOwnershipRequiredError(ValueError):
    """Raised when the user must be the owner of the library."""


def create_personal_library_for_user(
    db: Session,
    user: User,
    *,
    name: str = DEFAULT_PERSONAL_LIBRARY_NAME,
) -> Library:
    library = Library(name=name, type=LibraryType.PERSONAL)
    membership = UserLibrary(user=user, library=library, role=UserLibraryRole.OWNER)
    db.add(library)
    db.add(membership)
    return library


def list_user_libraries(
    db: Session,
    *,
    user_id: int,
) -> Sequence[tuple[Library, UserLibraryRole]]:
    stmt = (
        select(Library, UserLibrary.role)
        .join(UserLibrary, UserLibrary.library_id == Library.id)
        .where(UserLibrary.user_id == user_id)
        .order_by(Library.created_at.asc(), Library.id.asc())
    )
    return db.execute(stmt).all()


def create_shared_library(
    db: Session,
    *,
    user_id: int,
    name: str,
) -> tuple[Library, UserLibraryRole]:
    return create_library(
        db,
        user_id=user_id,
        name=name,
        library_type=LibraryType.SHARED,
    )


def create_library(
    db: Session,
    *,
    user_id: int,
    name: str,
    library_type: LibraryType,
) -> tuple[Library, UserLibraryRole]:
    library = Library(name=name, type=library_type)
    membership = UserLibrary(user_id=user_id, library=library, role=UserLibraryRole.OWNER)
    db.add(library)
    db.add(membership)
    db.commit()
    db.refresh(library)
    return library, membership.role


def get_user_library_membership(
    db: Session,
    *,
    user_id: int,
    library_id: int,
) -> tuple[Library, UserLibraryRole]:
    stmt = (
        select(Library, UserLibrary.role)
        .join(UserLibrary, UserLibrary.library_id == Library.id)
        .where(
            Library.id == library_id,
            UserLibrary.user_id == user_id,
        )
    )
    membership = db.execute(stmt).one_or_none()
    if membership is not None:
        return membership

    existing_library = db.get(Library, library_id)
    if existing_library is None:
        raise LibraryNotFoundError("La biblioteca no existe.")

    raise LibraryPermissionDeniedError(
        "No tienes permisos para acceder a esta biblioteca.",
    )


def get_accessible_library(
    db: Session,
    *,
    user_id: int,
    library_id: int,
) -> Library:
    library, _role = get_user_library_membership(
        db,
        user_id=user_id,
        library_id=library_id,
    )
    return library


def rename_library(
    db: Session,
    *,
    user_id: int,
    library_id: int,
    name: str,
) -> tuple[Library, UserLibraryRole]:
    library, role = get_user_library_membership(
        db,
        user_id=user_id,
        library_id=library_id,
    )
    if role != UserLibraryRole.OWNER:
        raise LibraryOwnershipRequiredError(
            "Solo el propietario puede renombrar esta biblioteca.",
        )

    library.name = name
    db.commit()
    db.refresh(library)
    return library, role
