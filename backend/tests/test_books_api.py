from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.book import UserCopy


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
    personal_library_id = get_personal_library_id(client, headers)
    shared_library_id = create_library(client, headers, name="Biblioteca compartida")

    dune = create_book(
        client,
        headers,
        personal_library_id,
        title="Dune",
        author="Frank Herbert",
        genre="Sci-Fi",
        reading_status="reading",
        user_rating=5,
    )
    create_book(
        client,
        headers,
        personal_library_id,
        title="Hyperion",
        author="Dan Simmons",
        genre="Sci-Fi",
        reading_status="pending",
        user_rating=4,
    )
    create_book(
        client,
        headers,
        shared_library_id,
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

    all_books_response = client.get("/books", headers=headers)
    assert all_books_response.status_code == 200
    assert {book["title"] for book in all_books_response.json()} == {"Dune", "Hyperion", "Emma"}

    scoped_response = client.get(f"/books?library_id={shared_library_id}", headers=headers)
    assert scoped_response.status_code == 200
    assert [book["title"] for book in scoped_response.json()] == ["Emma"]

    combined_response = client.get(
        "/books?q=dune&genre=sci-fi&reading_status=reading&min_rating=5",
        headers=headers,
    )
    assert combined_response.status_code == 200
    assert [book["title"] for book in combined_response.json()] == ["Dune"]


def test_copy_detail_user_data_and_list_genres(
    client: TestClient,
    db_session: Session,
) -> None:
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

    copy_response = client.get(f"/copies/{created['id']}", headers=headers)
    assert copy_response.status_code == 200
    copy_payload = copy_response.json()
    assert copy_payload["title"] == "Neuromancer"
    assert "reading_status" not in copy_payload
    assert "user_rating" not in copy_payload

    user_data_response = client.get(f"/copies/{created['id']}/user-data", headers=headers)
    assert user_data_response.status_code == 200
    assert user_data_response.json() == {
        "copy_id": created["id"],
        "reading_status": "pending",
        "rating": None,
        "start_date": None,
        "end_date": None,
        "personal_notes": None,
    }

    update_response = client.put(
        f"/copies/{created['id']}",
        headers=headers,
        json={
            "title": "Neuromancer",
            "authors": ["William Gibson"],
            "genres": ["Cyberpunk"],
            "description": "Un clasico cyberpunk.",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["description"] == "Un clasico cyberpunk."

    user_update_response = client.put(
        f"/copies/{created['id']}/user-data",
        headers=headers,
        json={
            "reading_status": "finished",
            "rating": 4,
            "personal_notes": "  Releer introduccion.  ",
        },
    )
    assert user_update_response.status_code == 200
    user_payload = user_update_response.json()
    assert user_payload["reading_status"] == "finished"
    assert user_payload["rating"] == 4
    assert user_payload["personal_notes"] == "Releer introduccion."
    assert user_payload["end_date"] == str(date.today())

    books_response = client.get("/books?reading_status=finished&min_rating=4", headers=headers)
    assert books_response.status_code == 200
    assert [book["title"] for book in books_response.json()] == ["Neuromancer"]

    genres_response = client.get("/genres", headers=headers)
    assert genres_response.status_code == 200
    assert genres_response.json() == ["Cyberpunk"]

    db_session.execute(
        delete(UserCopy).where(
            UserCopy.user_id == 1,
            UserCopy.copy_id == created["id"],
        ),
    )
    db_session.commit()

    default_user_data_response = client.get(f"/copies/{created['id']}/user-data", headers=headers)
    assert default_user_data_response.status_code == 200
    assert default_user_data_response.json()["reading_status"] == "pending"
    assert default_user_data_response.json()["rating"] is None
