from __future__ import annotations

from fastapi.testclient import TestClient


def register_user(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "name": "Ada Lovelace",
            "email": "ada@example.com",
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
    assert len(libraries) == 1
    return libraries[0]["id"]


def create_book(
    client: TestClient,
    headers: dict[str, str],
    library_id: int,
    *,
    title: str,
    author: str,
    genre: str,
    reading_status: str,
    user_rating: int | None,
) -> dict[str, object]:
    response = client.post(
        "/books",
        headers=headers,
        json={
            "library_id": library_id,
            "title": title,
            "authors": [author],
            "genres": [genre],
            "reading_status": reading_status,
            "user_rating": user_rating,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_books_catalog_filters_and_defaults(client: TestClient) -> None:
    headers = register_user(client)
    library_id = get_personal_library_id(client, headers)

    dune = create_book(
        client,
        headers,
        library_id,
        title="Dune",
        author="Frank Herbert",
        genre="Sci-Fi",
        reading_status="reading",
        user_rating=5,
    )
    create_book(
        client,
        headers,
        library_id,
        title="Hyperion",
        author="Dan Simmons",
        genre="Sci-Fi",
        reading_status="pending",
        user_rating=4,
    )
    create_book(
        client,
        headers,
        library_id,
        title="Emma",
        author="Jane Austen",
        genre="Clasico",
        reading_status="finished",
        user_rating=3,
    )

    assert dune["format"] == "physical"
    assert dune["reading_status"] == "reading"
    assert dune["user_rating"] == 5

    reading_response = client.get("/books?reading_status=reading", headers=headers)
    assert reading_response.status_code == 200
    assert [book["title"] for book in reading_response.json()] == ["Dune"]

    rating_response = client.get("/books?min_rating=4", headers=headers)
    assert rating_response.status_code == 200
    assert {book["title"] for book in rating_response.json()} == {"Dune", "Hyperion"}

    genre_response = client.get("/books?genre=sci-fi", headers=headers)
    assert genre_response.status_code == 200
    assert {book["title"] for book in genre_response.json()} == {"Dune", "Hyperion"}

    search_response = client.get("/books?q=frank", headers=headers)
    assert search_response.status_code == 200
    assert [book["title"] for book in search_response.json()] == ["Dune"]

    combined_response = client.get(
        "/books?q=dune&genre=sci-fi&reading_status=reading&min_rating=5",
        headers=headers,
    )
    assert combined_response.status_code == 200
    assert [book["title"] for book in combined_response.json()] == ["Dune"]


def test_update_book_and_list_genres(client: TestClient) -> None:
    headers = register_user(client)
    library_id = get_personal_library_id(client, headers)

    created = create_book(
        client,
        headers,
        library_id,
        title="Neuromancer",
        author="William Gibson",
        genre="Cyberpunk",
        reading_status="pending",
        user_rating=None,
    )

    update_response = client.put(
        f"/books/{created['id']}",
        headers=headers,
        json={
          "title": "Neuromancer",
          "authors": ["William Gibson"],
          "genres": ["Cyberpunk"],
          "reading_status": "finished",
          "user_rating": 4,
        },
    )
    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["reading_status"] == "finished"
    assert payload["user_rating"] == 4

    genres_response = client.get("/genres", headers=headers)
    assert genres_response.status_code == 200
    assert genres_response.json() == ["Cyberpunk"]
