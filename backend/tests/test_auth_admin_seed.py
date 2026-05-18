from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import verify_password
from app.models.enums import LibraryType
from app.models.enums import ListType
from app.models.library import Library
from app.models.library import UserLibrary
from app.models.list import List
from app.models.user import User
from app.schemas.auth import UserRegister
from app.services.admin_seed import AdminSeedConfigurationError
from app.services.admin_seed import get_admin_seed_config
from app.services.admin_seed import seed_development_admin
from app.services.auth import register_user


def build_settings(**overrides: str | None) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_regular_auth_responses_expose_is_admin_false(client: TestClient) -> None:
    register_response = client.post(
        "/auth/register",
        json={
            "name": "Ada Lovelace",
            "email": "ada@example.com",
            "password": "supersecret123",
        },
    )

    assert register_response.status_code == 201
    register_payload = register_response.json()
    assert register_payload["user"]["is_admin"] is False

    token = register_payload["access_token"]
    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["is_admin"] is False

    login_response = client.post(
        "/auth/login",
        json={
            "email": "ada@example.com",
            "password": "supersecret123",
        },
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["is_admin"] is False


def test_login_preflight_allows_www_localhost_origin(client: TestClient) -> None:
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://www.localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://www.localhost:5173"
    assert "POST" in response.headers["access-control-allow-methods"]


def test_seeded_admin_can_authenticate_as_admin(
    client: TestClient,
    db_session: Session,
) -> None:
    settings = build_settings(
        admin_name="Dev Admin",
        admin_email="admin@example.com",
        admin_password="supersecret123",
    )
    seed_development_admin(db_session, settings)

    login_response = client.post(
        "/auth/login",
        json={
            "email": "admin@example.com",
            "password": "supersecret123",
        },
    )
    assert login_response.status_code == 200
    login_payload = login_response.json()
    assert login_payload["user"]["is_admin"] is True

    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {login_payload['access_token']}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["is_admin"] is True


def test_inactive_users_cannot_log_in(client: TestClient, db_session: Session) -> None:
    register_response = client.post(
        "/auth/register",
        json={
            "name": "Inactive User",
            "email": "inactive@example.com",
            "password": "supersecret123",
        },
    )
    assert register_response.status_code == 201

    user = db_session.scalar(select(User).where(User.email == "inactive@example.com"))
    assert user is not None
    user.is_active = False
    db_session.commit()

    login_response = client.post(
        "/auth/login",
        json={
            "email": "inactive@example.com",
            "password": "supersecret123",
        },
    )
    assert login_response.status_code == 401
    assert login_response.json()["detail"] == "Email o contrasena incorrectos."


def test_seed_development_admin_creates_user_and_default_resources(
    db_session: Session,
) -> None:
    settings = build_settings(
        admin_name="Dev Admin",
        admin_email="admin@example.com",
        admin_password="supersecret123",
    )

    user = seed_development_admin(db_session, settings)

    assert user is not None
    assert user.email == "admin@example.com"
    assert user.is_superuser is True
    assert user.is_active is True

    library_count = db_session.scalar(
        select(func.count(Library.id))
        .join(UserLibrary, UserLibrary.library_id == Library.id)
        .where(
            UserLibrary.user_id == user.id,
            Library.type == LibraryType.PERSONAL,
        ),
    )
    assert library_count == 1

    default_lists = db_session.scalars(
        select(List.type).where(List.user_id == user.id).order_by(List.id.asc()),
    ).all()
    assert default_lists == [ListType.WISHLIST, ListType.PENDING]


def test_seed_development_admin_is_idempotent_and_synchronizes_existing_user(
    db_session: Session,
) -> None:
    existing_user = register_user(
        db_session,
        UserRegister(
            name="Regular Admin",
            email="admin@example.com",
            password="oldpassword123",
        ),
    )
    existing_user_id = existing_user.id

    settings = build_settings(
        admin_name="Seeded Admin",
        admin_email="ADMIN@example.com",
        admin_password="supersecret123",
    )

    first_seed = seed_development_admin(db_session, settings)
    second_seed = seed_development_admin(db_session, settings)

    assert first_seed is not None
    assert second_seed is not None
    assert first_seed.id == existing_user_id
    assert second_seed.id == existing_user_id

    user = db_session.scalar(select(User).where(User.email == "admin@example.com"))
    assert user is not None
    assert user.name == "Seeded Admin"
    assert user.is_superuser is True
    assert user.is_active is True
    assert verify_password("supersecret123", user.password_hash)

    user_count = db_session.scalar(
        select(func.count(User.id)).where(User.email == "admin@example.com"),
    )
    assert user_count == 1

    personal_library_count = db_session.scalar(
        select(func.count(Library.id))
        .join(UserLibrary, UserLibrary.library_id == Library.id)
        .where(
            UserLibrary.user_id == user.id,
            Library.type == LibraryType.PERSONAL,
        ),
    )
    assert personal_library_count == 1

    list_types = db_session.scalars(
        select(List.type).where(List.user_id == user.id).order_by(List.id.asc()),
    ).all()
    assert list_types == [ListType.WISHLIST, ListType.PENDING]


def test_seed_development_admin_skips_when_not_configured(
    db_session: Session,
) -> None:
    result = seed_development_admin(db_session, build_settings())

    assert result is None
    user_count = db_session.scalar(select(func.count(User.id)))
    assert user_count == 0


def test_partial_admin_settings_raise_configuration_error() -> None:
    settings = build_settings(admin_email="admin@example.com")

    with pytest.raises(AdminSeedConfigurationError):
        get_admin_seed_config(settings)


def test_production_settings_require_a_non_default_secret_key() -> None:
    with pytest.raises(ValueError, match="SECRET_KEY debe configurarse"):
        build_settings(environment="production")


def test_production_settings_accept_a_custom_secret_key() -> None:
    settings = build_settings(
        environment="production",
        secret_key="super-secret-key-for-production",
    )

    assert settings.secret_key == "super-secret-key-for-production"
