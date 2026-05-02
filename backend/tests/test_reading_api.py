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
    personal_library = next(
        library for library in response.json() if library["type"] == "personal"
    )
    return int(personal_library["id"])


def create_library(client: TestClient, headers: dict[str, str], *, name: str) -> int:
    response = client.post(
        "/libraries",
        headers=headers,
        json={
            "name": name,
            "type": "shared",
        },
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def create_book(
    client: TestClient,
    headers: dict[str, str],
    *,
    library_id: int,
    title: str,
    reading_status: str = "pending",
) -> dict[str, object]:
    response = client.post(
        "/books",
        headers=headers,
        json={
            "library_id": library_id,
            "title": title,
            "authors": ["Octavia Butler"],
            "genre": "narrativo",
            "themes": ["Ciencia ficcion"],
            "reading_status": reading_status,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_reading_endpoint_lists_user_reading_data(client: TestClient) -> None:
    headers = register_user(client, name="Reader", email="reader@example.com")
    library_id = get_personal_library_id(client, headers)

    pending_book = create_book(
        client,
        headers,
        library_id=library_id,
        title="Kindred",
        reading_status="pending",
    )
    reading_book = create_book(
        client,
        headers,
        library_id=library_id,
        title="Parable of the Sower",
        reading_status="reading",
    )

    update_response = client.put(
        f"/copies/{reading_book['id']}/user-data",
        headers=headers,
        json={
            "rating": 5,
            "start_date": "2026-04-10",
            "personal_notes": "Lectura principal",
        },
    )
    assert update_response.status_code == 200

    response = client.get("/reading", headers=headers)
    assert response.status_code == 200
    payload = response.json()

    assert [item["title"] for item in payload] == ["Kindred", "Parable of the Sower"]

    pending_item = next(item for item in payload if item["title"] == "Kindred")
    assert pending_item["copy_id"] == pending_book["id"]
    assert pending_item["reading_status"] == "pending"
    assert pending_item["rating"] is None
    assert pending_item["start_date"] is None
    assert pending_item["end_date"] is None
    assert pending_item["personal_notes"] is None

    reading_item = next(item for item in payload if item["title"] == "Parable of the Sower")
    assert reading_item["reading_status"] == "reading"
    assert reading_item["rating"] == 5
    assert reading_item["personal_notes"] == "Lectura principal"
    assert reading_item["start_date"] == "2026-04-10"


def test_reading_endpoint_treats_missing_user_copy_as_pending(client: TestClient) -> None:
    owner_headers = register_user(client, name="Owner", email="owner-reading@example.com")
    personal_library_id = get_personal_library_id(client, owner_headers)
    created = create_book(
        client,
        owner_headers,
        library_id=personal_library_id,
        title="Wild Seed",
    )

    response = client.get(f"/copies/{created['id']}/user-data", headers=owner_headers)
    assert response.status_code == 200
    assert response.json()["reading_status"] == "pending"

    reading_response = client.get("/reading", headers=owner_headers)
    assert reading_response.status_code == 200
    item = next(entry for entry in reading_response.json() if entry["copy_id"] == created["id"])
    assert item["reading_status"] == "pending"


def test_reading_endpoint_supports_library_filter_and_excludes_archived_libraries(client: TestClient) -> None:
    headers = register_user(client, name="Archivist", email="archivist@example.com")
    personal_library_id = get_personal_library_id(client, headers)
    shared_library_id = create_library(client, headers, name="Club nocturno")

    create_book(
        client,
        headers,
        library_id=personal_library_id,
        title="Dawn",
        reading_status="reading",
    )
    create_book(
        client,
        headers,
        library_id=shared_library_id,
        title="Patternmaster",
        reading_status="finished",
    )

    scoped_response = client.get(f"/reading?library_id={shared_library_id}", headers=headers)
    assert scoped_response.status_code == 200
    assert [item["title"] for item in scoped_response.json()] == ["Patternmaster"]

    archive_response = client.post(f"/libraries/{shared_library_id}/archive", headers=headers)
    assert archive_response.status_code == 200

    filtered_response = client.get("/reading", headers=headers)
    assert filtered_response.status_code == 200
    assert [item["title"] for item in filtered_response.json()] == ["Dawn"]

    archived_response = client.get(f"/reading?library_id={shared_library_id}", headers=headers)
    assert archived_response.status_code == 409


def test_reading_endpoint_blocks_inaccessible_libraries(client: TestClient) -> None:
    owner_headers = register_user(client, name="Owner", email="owner-shelf@example.com")
    intruder_headers = register_user(client, name="Intruder", email="intruder-shelf@example.com")
    owner_library_id = get_personal_library_id(client, owner_headers)

    response = client.get(f"/reading?library_id={owner_library_id}", headers=intruder_headers)
    assert response.status_code == 403
