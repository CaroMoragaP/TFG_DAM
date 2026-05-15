from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.book import Book
from app.models.book import Copy
from app.models.library import Library
from app.models.library import UserLibrary
from app.models.social import CopyLoan
from app.models.social import LibraryEvent
from app.models.social import Review
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


def test_shared_library_membership_and_delete(client: TestClient) -> None:
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


def test_shared_library_ownership_transfer_and_members_can_leave(client: TestClient) -> None:
    owner_headers = register_user(client, email="owner-transfer@example.com")

    editor_register_response = client.post(
        "/auth/register",
        json={
            "name": "Editor",
            "email": "editor-transfer@example.com",
            "password": "supersecret123",
        },
    )
    assert editor_register_response.status_code == 201
    editor_headers = {"Authorization": f"Bearer {editor_register_response.json()['access_token']}"}

    viewer_register_response = client.post(
        "/auth/register",
        json={
            "name": "Viewer",
            "email": "viewer-transfer@example.com",
            "password": "supersecret123",
        },
    )
    assert viewer_register_response.status_code == 201
    viewer_headers = {"Authorization": f"Bearer {viewer_register_response.json()['access_token']}"}

    create_response = client.post(
        "/libraries",
        headers=owner_headers,
        json={
            "name": "Biblioteca transferible",
            "type": "shared",
        },
    )
    assert create_response.status_code == 201
    library_id = create_response.json()["id"]

    add_editor_response = client.post(
        f"/libraries/{library_id}/members",
        headers=owner_headers,
        json={
            "email": "editor-transfer@example.com",
            "role": "editor",
        },
    )
    assert add_editor_response.status_code == 201
    editor_user_id = add_editor_response.json()["user_id"]

    add_viewer_response = client.post(
        f"/libraries/{library_id}/members",
        headers=owner_headers,
        json={
            "email": "viewer-transfer@example.com",
            "role": "viewer",
        },
    )
    assert add_viewer_response.status_code == 201

    owner_leave_response = client.delete(f"/libraries/{library_id}/me", headers=owner_headers)
    assert owner_leave_response.status_code == 403

    transfer_response = client.post(
        f"/libraries/{library_id}/transfer-ownership",
        headers=owner_headers,
        json={"member_user_id": editor_user_id},
    )
    assert transfer_response.status_code == 200
    assert transfer_response.json()["role"] == "editor"

    old_owner_members_response = client.get(f"/libraries/{library_id}/members", headers=owner_headers)
    assert old_owner_members_response.status_code == 403

    new_owner_members_response = client.get(f"/libraries/{library_id}/members", headers=editor_headers)
    assert new_owner_members_response.status_code == 200
    roles_by_email = {
        member["email"]: member["role"]
        for member in new_owner_members_response.json()
    }
    assert roles_by_email["owner-transfer@example.com"] == "editor"
    assert roles_by_email["editor-transfer@example.com"] == "owner"
    assert roles_by_email["viewer-transfer@example.com"] == "viewer"

    viewer_leave_response = client.delete(f"/libraries/{library_id}/me", headers=viewer_headers)
    assert viewer_leave_response.status_code == 204

    editor_leave_response = client.delete(f"/libraries/{library_id}/me", headers=owner_headers)
    assert editor_leave_response.status_code == 204

    viewer_libraries_response = client.get("/libraries", headers=viewer_headers)
    assert viewer_libraries_response.status_code == 200
    assert all(item["id"] != library_id for item in viewer_libraries_response.json())

    former_owner_libraries_response = client.get("/libraries", headers=owner_headers)
    assert former_owner_libraries_response.status_code == 200
    assert all(item["id"] != library_id for item in former_owner_libraries_response.json())


def test_shared_library_delete_cascades_copies_but_keeps_books(
    client: TestClient,
    db_session: Session,
) -> None:
    owner_headers = register_user(client, email="owner-delete@example.com")

    viewer_register_response = client.post(
        "/auth/register",
        json={
            "name": "Viewer",
            "email": "viewer-delete@example.com",
            "password": "supersecret123",
        },
    )
    assert viewer_register_response.status_code == 201
    viewer_headers = {"Authorization": f"Bearer {viewer_register_response.json()['access_token']}"}

    create_response = client.post(
        "/libraries",
        headers=owner_headers,
        json={
            "name": "Biblioteca borrable",
            "type": "shared",
        },
    )
    assert create_response.status_code == 201
    library_id = create_response.json()["id"]

    add_viewer_response = client.post(
        f"/libraries/{library_id}/members",
        headers=owner_headers,
        json={
            "email": "viewer-delete@example.com",
            "role": "viewer",
        },
    )
    assert add_viewer_response.status_code == 201

    book_response = client.post(
        "/books",
        headers=owner_headers,
        json={
            "library_id": library_id,
            "title": "Kindred",
            "authors": ["Octavia E. Butler"],
            "genre": "narrativo",
            "themes": ["Sci-Fi"],
            "reading_status": "pending",
        },
    )
    assert book_response.status_code == 201
    copy_id = int(book_response.json()["id"])
    book_id = int(book_response.json()["book_id"])

    rating_response = client.put(
        f"/copies/{copy_id}/user-data",
        headers=viewer_headers,
        json={"rating": 5, "reading_status": "reading"},
    )
    assert rating_response.status_code == 200

    review_response = client.post(
        f"/copies/{copy_id}/reviews",
        headers=viewer_headers,
        json={"body": "Gran lectura."},
    )
    assert review_response.status_code == 201

    loan_response = client.post(
        f"/copies/{copy_id}/loans",
        headers=owner_headers,
        json={"borrower_name": "Externo"},
    )
    assert loan_response.status_code == 201

    blocked_delete_response = client.delete(f"/libraries/{library_id}", headers=owner_headers)
    assert blocked_delete_response.status_code == 409

    viewer_leave_response = client.delete(f"/libraries/{library_id}/me", headers=viewer_headers)
    assert viewer_leave_response.status_code == 204

    delete_response = client.delete(f"/libraries/{library_id}", headers=owner_headers)
    assert delete_response.status_code == 204

    assert db_session.get(Library, library_id) is None
    assert db_session.get(Copy, copy_id) is None
    assert db_session.get(Book, book_id) is not None
    assert db_session.scalar(
        select(UserLibrary).where(UserLibrary.library_id == library_id),
    ) is None
    assert db_session.scalar(
        select(Review).where(Review.copy_id == copy_id),
    ) is None
    assert db_session.scalar(
        select(CopyLoan).where(CopyLoan.copy_id == copy_id),
    ) is None
    assert db_session.scalar(
        select(LibraryEvent).where(LibraryEvent.library_id == library_id),
    ) is None


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
