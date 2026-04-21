from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.core.security import verify_password
from app.models.user import User
from app.schemas.auth import UserLogin
from app.schemas.auth import UserRegister
from app.services.libraries import create_personal_library_for_user
from app.services.lists import create_default_lists_for_user


class DuplicateEmailError(ValueError):
    """Raised when registering with an email that already exists."""


class InvalidCredentialsError(ValueError):
    """Raised when the provided login credentials are invalid."""


def register_user(db: Session, data: UserRegister) -> User:
    normalized_email = data.email.strip().lower()
    existing_user = db.scalar(select(User).where(User.email == normalized_email))

    if existing_user is not None:
        raise DuplicateEmailError("Ya existe una cuenta con ese email.")

    user = User(
        name=data.name.strip(),
        email=normalized_email,
        password_hash=get_password_hash(data.password),
    )
    db.add(user)
    db.flush()
    create_personal_library_for_user(db, user)
    create_default_lists_for_user(db, user_id=user.id)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, data: UserLogin) -> User:
    normalized_email = data.email.strip().lower()
    user = db.scalar(select(User).where(User.email == normalized_email))

    if user is None or not verify_password(data.password, user.password_hash):
        raise InvalidCredentialsError("Email o contrasena incorrectos.")

    return user
