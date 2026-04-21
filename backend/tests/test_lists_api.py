from __future__ import annotations

from fastapi.testclient import TestClient


def register_user(
    client: TestClient,
    *,
    name: str,
    email: str,
) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "supersecret123",
        },
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def get_personal_library_id(client: TestClient, headers: dict[str, str]) -> int:
    response = client.get("/libraries", headers=headers)
    assert response.status_code == 200
    libraries = response.json()
    assert len(libraries) >= 1
    personal_library = next(
        library for library in libraries if library["type"] == "personal"
    )
    return int(personal_library["id"])


def create_book(
    client: TestClient,
    headers: dict[str, str],
    library_id: int,
    *,
    title: str,
) -> dict[str, object]:
    response = client.post(
        "/books",
        headers=headers,
        json={
            "library_id": library_id,
            "title": title,
            "authors": ["Octavia Butler"],
            "genres": ["Sci-Fi"],
            "reading_status": "pending",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_register_creates_default_lists(client: TestClient) -> None:
    headers = register_user(client, name="Ada Lovelace", email="ada@example.com")

    response = client.get("/lists", headers=headers)
    assert response.status_code == 200
    payload = response.json()

    assert [item["name"] for item in payload] == ["Favoritos", "Pendientes"]
    assert [item["type"] for item in payload] == ["wishlist", "pending"]
    assert all(item["library_id"] is None for item in payload)


def test_lists_crud_and_book_membership(client: TestClient) -> None:
    headers = register_user(client, name="Grace Hopper", email="grace@example.com")
    library_id = get_personal_library_id(client, headers)
    created_book = create_book(
        client,
        headers,
        library_id,
        title="Kindred",
    )

    create_list_response = client.post(
        "/lists",
        headers=headers,
        json={
            "name": "Club de sci-fi",
            "type": "custom",
            "library_id": library_id,
        },
    )
    assert create_list_response.status_code == 201
    created_list = create_list_response.json()
    assert created_list["book_count"] == 0

    add_book_response = client.post(
        f"/lists/{created_list['id']}/books",
        headers=headers,
        json={"book_id": created_book["book_id"]},
    )
    assert add_book_response.status_code == 204

    duplicate_response = client.post(
        f"/lists/{created_list['id']}/books",
        headers=headers,
        json={"book_id": created_book["book_id"]},
    )
    assert duplicate_response.status_code == 409

    list_books_response = client.get(
        f"/lists/{created_list['id']}/books",
        headers=headers,
    )
    assert list_books_response.status_code == 200
    assert [item["title"] for item in list_books_response.json()] == ["Kindred"]

    update_list_response = client.put(
        f"/lists/{created_list['id']}",
        headers=headers,
        json={
          "name": "Sci-Fi compartida",
          "type": "custom",
          "library_id": None,
        },
    )
    assert update_list_response.status_code == 200
    assert update_list_response.json()["library_id"] is None

    remove_book_response = client.delete(
        f"/lists/{created_list['id']}/books/{created_book['book_id']}",
        headers=headers,
    )
    assert remove_book_response.status_code == 204

    delete_list_response = client.delete(
        f"/lists/{created_list['id']}",
        headers=headers,
    )
    assert delete_list_response.status_code == 204


def test_cannot_access_another_users_list(client: TestClient) -> None:
    owner_headers = register_user(client, name="Owner", email="owner@example.com")
    intruder_headers = register_user(client, name="Intruder", email="intruder@example.com")

    create_list_response = client.post(
        "/lists",
        headers=owner_headers,
        json={
            "name": "Privada",
            "type": "custom",
            "library_id": None,
        },
    )
    assert create_list_response.status_code == 201
    list_id = create_list_response.json()["id"]

    intruder_response = client.get(f"/lists/{list_id}/books", headers=intruder_headers)
    assert intruder_response.status_code == 404
