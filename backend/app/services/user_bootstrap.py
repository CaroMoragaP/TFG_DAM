from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.libraries import create_personal_library_for_user
from app.services.lists import create_default_lists_for_user


def ensure_user_default_resources(db: Session, user: User) -> None:
    create_personal_library_for_user(db, user)
    create_default_lists_for_user(db, user_id=user.id)
