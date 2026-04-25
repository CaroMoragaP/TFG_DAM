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
    assert rename_response.json()["is_archived"] is False


def test_shared_library_membership_archive_restore_and_delete(client: TestClient) -> None:
    owner_headers = register_user(client, email="owner-library@example.com")

    editor_register_response = client.post(
        "/auth/register",
        json={
            "name": "Editor",
            "email": "editor-library@example.com",
            "password": "supersecret123",
        },
    )
    assert editor_register_response.status_code == 201

    viewer_register_response = client.post(
        "/auth/register",
        json={
            "name": "Viewer",
            "email": "viewer-library@example.com",
            "password": "supersecret123",
        },
    )
    assert viewer_register_response.status_code == 201

    create_response = client.post(
        "/libraries",
        headers=owner_headers,
        json={
            "name": "Biblioteca compartida",
            "type": "shared",
        },
    )
    assert create_response.status_code == 201
    library_id = create_response.json()["id"]

    add_editor_response = client.post(
        f"/libraries/{library_id}/members",
        headers=owner_headers,
        json={
            "email": "editor-library@example.com",
            "role": "editor",
        },
    )
    assert add_editor_response.status_code == 201

    add_viewer_response = client.post(
        f"/libraries/{library_id}/members",
        headers=owner_headers,
        json={
            "email": "viewer-library@example.com",
            "role": "viewer",
        },
    )
    assert add_viewer_response.status_code == 201

    members_response = client.get(f"/libraries/{library_id}/members", headers=owner_headers)
    assert members_response.status_code == 200
    assert {member["role"] for member in members_response.json()} == {"owner", "editor", "viewer"}

    archive_response = client.post(f"/libraries/{library_id}/archive", headers=owner_headers)
    assert archive_response.status_code == 200
    assert archive_response.json()["is_archived"] is True

    default_list_response = client.get("/libraries", headers=owner_headers)
    assert default_list_response.status_code == 200
    assert all(item["id"] != library_id for item in default_list_response.json())

    archived_list_response = client.get("/libraries?include_archived=true", headers=owner_headers)
    assert archived_list_response.status_code == 200
    archived_library = next(item for item in archived_list_response.json() if item["id"] == library_id)
    assert archived_library["is_archived"] is True

    restore_response = client.post(f"/libraries/{library_id}/restore", headers=owner_headers)
    assert restore_response.status_code == 200
    assert restore_response.json()["is_archived"] is False

    delete_while_members_response = client.delete(f"/libraries/{library_id}", headers=owner_headers)
    assert delete_while_members_response.status_code == 409

    members_payload = members_response.json()
    editor_member = next(member for member in members_payload if member["role"] == "editor")
    viewer_member = next(member for member in members_payload if member["role"] == "viewer")

    remove_editor_response = client.delete(
        f"/libraries/{library_id}/members/{editor_member['user_id']}",
        headers=owner_headers,
    )
    assert remove_editor_response.status_code == 204

    remove_viewer_response = client.delete(
        f"/libraries/{library_id}/members/{viewer_member['user_id']}",
        headers=owner_headers,
    )
    assert remove_viewer_response.status_code == 204

    delete_response = client.delete(f"/libraries/{library_id}", headers=owner_headers)
    assert delete_response.status_code == 204


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
