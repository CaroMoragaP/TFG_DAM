from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.book import Copy
from app.models.enums import LibraryType
from app.models.enums import UserLibraryRole
from app.models.library import Library
from app.models.library import UserLibrary
from app.models.user import User

DEFAULT_PERSONAL_LIBRARY_NAME = "Biblioteca personal"
READ_ACCESS_ROLES = frozenset(
    {
        UserLibraryRole.OWNER,
        UserLibraryRole.EDITOR,
        UserLibraryRole.VIEWER,
    },
)
CATALOG_MANAGEMENT_ROLES = frozenset(
    {
        UserLibraryRole.OWNER,
        UserLibraryRole.EDITOR,
    },
)


class LibraryNotFoundError(ValueError):
    """Raised when the requested library does not exist."""


class LibraryPermissionDeniedError(ValueError):
    """Raised when the user cannot access the requested library."""


class LibraryOwnershipRequiredError(ValueError):
    """Raised when the user must be the owner of the library."""


class LibraryArchivedError(ValueError):
    """Raised when the requested library is archived and not operable."""


class LibraryRoleRequiredError(ValueError):
    """Raised when the membership role is insufficient for the requested action."""


class LibraryMemberConflictError(ValueError):
    """Raised when a membership change would duplicate or invalidate membership data."""


class LibraryMemberNotFoundError(ValueError):
    """Raised when a library member cannot be found."""


class LibraryMembershipOperationError(ValueError):
    """Raised when the requested membership operation is not valid for the library."""


class LibraryDeletionNotAllowedError(ValueError):
    """Raised when a library cannot be permanently deleted yet."""


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
    include_archived: bool = False,
) -> Sequence[tuple[Library, UserLibraryRole, int, int]]:
    member_count_subquery = (
        select(
            UserLibrary.library_id.label("library_id"),
            func.count(UserLibrary.user_id).label("member_count"),
        )
        .group_by(UserLibrary.library_id)
        .subquery()
    )
    copy_count_subquery = (
        select(
            Copy.library_id.label("library_id"),
            func.count(Copy.id).label("copy_count"),
        )
        .group_by(Copy.library_id)
        .subquery()
    )

    stmt = (
        select(
            Library,
            UserLibrary.role,
            func.coalesce(member_count_subquery.c.member_count, 0),
            func.coalesce(copy_count_subquery.c.copy_count, 0),
        )
        .join(UserLibrary, UserLibrary.library_id == Library.id)
        .outerjoin(member_count_subquery, member_count_subquery.c.library_id == Library.id)
        .outerjoin(copy_count_subquery, copy_count_subquery.c.library_id == Library.id)
        .where(UserLibrary.user_id == user_id)
        .order_by(Library.created_at.asc(), Library.id.asc())
    )
    if not include_archived:
        stmt = stmt.where(Library.archived_at.is_(None))

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
    allowed_roles: frozenset[UserLibraryRole] | None = None,
    allow_archived: bool = False,
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
    if membership is None:
        existing_library = db.get(Library, library_id)
        if existing_library is None:
            raise LibraryNotFoundError("La biblioteca no existe.")

        raise LibraryPermissionDeniedError(
            "No tienes permisos para acceder a esta biblioteca.",
        )

    library, role = membership
    if library.archived_at is not None and not allow_archived:
        raise LibraryArchivedError("La biblioteca archivada no admite esta operacion.")

    if allowed_roles is not None and role not in allowed_roles:
        if allowed_roles == frozenset({UserLibraryRole.OWNER}):
            raise LibraryOwnershipRequiredError(
                "Solo el propietario puede realizar esta accion.",
            )
        raise LibraryRoleRequiredError(
            "Tu rol en esta biblioteca no permite realizar esta accion.",
        )

    return library, role


def get_accessible_library(
    db: Session,
    *,
    user_id: int,
    library_id: int,
    allowed_roles: frozenset[UserLibraryRole] | None = None,
    allow_archived: bool = False,
) -> Library:
    library, _role = get_user_library_membership(
        db,
        user_id=user_id,
        library_id=library_id,
        allowed_roles=allowed_roles,
        allow_archived=allow_archived,
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
        allowed_roles=frozenset({UserLibraryRole.OWNER}),
        allow_archived=True,
    )
    library.name = name
    db.commit()
    db.refresh(library)
    return library, role


def list_library_members(
    db: Session,
    *,
    user_id: int,
    library_id: int,
) -> Sequence[tuple[User, UserLibraryRole]]:
    library, _role = _get_shared_library_for_owner(
        db,
        user_id=user_id,
        library_id=library_id,
        allow_archived=True,
    )
    del library
    stmt = (
        select(User, UserLibrary.role)
        .join(UserLibrary, UserLibrary.user_id == User.id)
        .where(UserLibrary.library_id == library_id)
        .order_by(User.name.asc(), User.id.asc())
    )
    return db.execute(stmt).all()


def add_library_member(
    db: Session,
    *,
    user_id: int,
    library_id: int,
    email: str,
    role: UserLibraryRole,
) -> tuple[User, UserLibraryRole]:
    library, _owner_role = _get_shared_library_for_owner(
        db,
        user_id=user_id,
        library_id=library_id,
    )
    del library

    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        raise LibraryMemberNotFoundError("No existe ningun usuario registrado con ese email.")

    existing_membership = db.scalar(
        select(UserLibrary).where(
            UserLibrary.user_id == user.id,
            UserLibrary.library_id == library_id,
        ),
    )
    if existing_membership is not None:
        raise LibraryMemberConflictError("Ese usuario ya pertenece a la biblioteca.")

    membership = UserLibrary(user_id=user.id, library_id=library_id, role=role)
    db.add(membership)
    db.commit()
    return user, membership.role


def update_library_member_role(
    db: Session,
    *,
    user_id: int,
    library_id: int,
    member_user_id: int,
    role: UserLibraryRole,
) -> tuple[User, UserLibraryRole]:
    library, _owner_role = _get_shared_library_for_owner(
        db,
        user_id=user_id,
        library_id=library_id,
    )
    del library

    membership = db.scalar(
        select(UserLibrary).where(
            UserLibrary.user_id == member_user_id,
            UserLibrary.library_id == library_id,
        ),
    )
    if membership is None:
        raise LibraryMemberNotFoundError("El miembro indicado no pertenece a la biblioteca.")
    if membership.role == UserLibraryRole.OWNER:
        raise LibraryMembershipOperationError(
            "No se puede modificar el rol del propietario.",
        )

    membership.role = role
    db.commit()
    user = db.get(User, member_user_id)
    assert user is not None
    return user, membership.role


def remove_library_member(
    db: Session,
    *,
    user_id: int,
    library_id: int,
    member_user_id: int,
) -> None:
    library, _owner_role = _get_shared_library_for_owner(
        db,
        user_id=user_id,
        library_id=library_id,
    )
    del library

    membership = db.scalar(
        select(UserLibrary).where(
            UserLibrary.user_id == member_user_id,
            UserLibrary.library_id == library_id,
        ),
    )
    if membership is None:
        raise LibraryMemberNotFoundError("El miembro indicado no pertenece a la biblioteca.")
    if membership.role == UserLibraryRole.OWNER:
        raise LibraryMembershipOperationError(
            "No se puede expulsar al propietario de la biblioteca.",
        )

    db.delete(membership)
    db.commit()


def archive_library(
    db: Session,
    *,
    user_id: int,
    library_id: int,
) -> tuple[Library, UserLibraryRole]:
    library, role = _get_shared_library_for_owner(
        db,
        user_id=user_id,
        library_id=library_id,
        allow_archived=True,
    )
    if library.archived_at is None:
        library.archived_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(library)
    return library, role


def restore_library(
    db: Session,
    *,
    user_id: int,
    library_id: int,
) -> tuple[Library, UserLibraryRole]:
    library, role = _get_shared_library_for_owner(
        db,
        user_id=user_id,
        library_id=library_id,
        allow_archived=True,
    )
    if library.archived_at is not None:
        library.archived_at = None
        db.commit()
        db.refresh(library)
    return library, role


def delete_library(
    db: Session,
    *,
    user_id: int,
    library_id: int,
) -> None:
    library, _role = _get_shared_library_for_owner(
        db,
        user_id=user_id,
        library_id=library_id,
        allow_archived=True,
    )
    member_count, copy_count = _get_library_counts(db, library_id=library_id)
    additional_member_count = max(member_count - 1, 0)
    if additional_member_count > 0:
        raise LibraryDeletionNotAllowedError(
            "No puedes borrar definitivamente una biblioteca con miembros adicionales.",
        )
    if copy_count > 0:
        raise LibraryDeletionNotAllowedError(
            "No puedes borrar definitivamente una biblioteca que todavia contiene libros.",
        )

    db.delete(library)
    db.commit()


def _get_shared_library_for_owner(
    db: Session,
    *,
    user_id: int,
    library_id: int,
    allow_archived: bool = False,
) -> tuple[Library, UserLibraryRole]:
    library, role = get_user_library_membership(
        db,
        user_id=user_id,
        library_id=library_id,
        allowed_roles=frozenset({UserLibraryRole.OWNER}),
        allow_archived=allow_archived,
    )
    if library.type != LibraryType.SHARED:
        raise LibraryMembershipOperationError(
            "Esta operacion solo esta disponible para bibliotecas compartidas.",
        )
    return library, role


def _get_library_counts(
    db: Session,
    *,
    library_id: int,
) -> tuple[int, int]:
    member_count = db.scalar(
        select(func.count(UserLibrary.user_id)).where(UserLibrary.library_id == library_id),
    )
    copy_count = db.scalar(
        select(func.count(Copy.id)).where(Copy.library_id == library_id),
    )
    return int(member_count or 0), int(copy_count or 0)
