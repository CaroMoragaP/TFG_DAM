from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import get_password_hash
from app.core.security import verify_password
from app.models.user import User
from app.services.user_bootstrap import ensure_user_default_resources


class AdminSeedConfigurationError(ValueError):
    """Raised when ADMIN_* settings are partially configured or invalid."""


@dataclass(frozen=True)
class AdminSeedConfig:
    name: str
    email: str
    password: str


def get_admin_seed_config(settings: Settings) -> AdminSeedConfig | None:
    name = _normalize_optional_setting(settings.admin_name)
    email = _normalize_optional_setting(settings.admin_email)
    password = _normalize_optional_setting(settings.admin_password)

    configured_values = [name, email, password]
    if all(value is None for value in configured_values):
        return None
    if any(value is None for value in configured_values):
        raise AdminSeedConfigurationError(
            "Configuracion admin incompleta: define ADMIN_NAME, ADMIN_EMAIL y "
            "ADMIN_PASSWORD juntas o no definas ninguna.",
        )

    assert name is not None
    assert email is not None
    assert password is not None

    if len(password) < 8 or len(password) > 72:
        raise AdminSeedConfigurationError(
            "ADMIN_PASSWORD debe tener entre 8 y 72 caracteres.",
        )

    return AdminSeedConfig(
        name=name,
        email=email.lower(),
        password=password,
    )


def seed_development_admin(db: Session, settings: Settings) -> User | None:
    config = get_admin_seed_config(settings)
    if config is None:
        return None

    user = db.scalar(select(User).where(User.email == config.email))
    if user is None:
        user = User(
            name=config.name,
            email=config.email,
            password_hash=get_password_hash(config.password),
            is_superuser=True,
            is_active=True,
        )
        db.add(user)
        db.flush()
    else:
        user.name = config.name
        user.is_superuser = True
        user.is_active = True
        if not verify_password(config.password, user.password_hash):
            user.password_hash = get_password_hash(config.password)

    ensure_user_default_resources(db, user)
    db.commit()
    db.refresh(user)
    return user


def _normalize_optional_setting(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    return normalized
