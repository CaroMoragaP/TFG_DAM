from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.user import User


def register_user(client: TestClient, *, email: str) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "name": "Linus",
            "email": email,
            "password": "supersecret123",
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_create_and_rename_library(client: TestClient) -> None:
    headers = register_user(client, email="linus@example.com")

    create_response = client.post(
        "/libraries",
        headers=headers,
        json={
            "name": "Biblioteca de trabajo",
            "type": "shared",
        },
    )
    assert create_response.status_code == 201
    created_library = create_response.json()
    assert created_library["type"] == "shared"

    rename_response = client.put(
        f"/libraries/{created_library['id']}",
        headers=headers,
        json={"name": "Biblioteca del estudio"},
    )
    assert rename_response.status_code == 200
    assert rename_response.json()["name"] == "Biblioteca del estudio"


def test_list_libraries_supports_legacy_uppercase_enums(
    client: TestClient,
    db_session: Session,
) -> None:
    email = "legacy@example.com"
    headers = register_user(client, email=email)
    user = db_session.execute(select(User).where(User.email == email)).scalar_one()

    library_result = db_session.execute(
        text("INSERT INTO libraries (name, type) VALUES (:name, :type)"),
        {
            "name": "Biblioteca heredada",
            "type": "SHARED",
        },
    )
    legacy_library_id = library_result.lastrowid
    db_session.execute(
        text(
            """
            INSERT INTO user_libraries (user_id, library_id, role)
            VALUES (:user_id, :library_id, :role)
            """,
        ),
        {
            "user_id": user.id,
            "library_id": legacy_library_id,
            "role": "OWNER",
        },
    )
    db_session.commit()

    response = client.get("/libraries", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    legacy_library = next(item for item in payload if item["id"] == legacy_library_id)
    assert legacy_library["type"] == "shared"
    assert legacy_library["role"] == "owner"
