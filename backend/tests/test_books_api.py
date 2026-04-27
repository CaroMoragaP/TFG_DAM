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


def create_list(client: TestClient, headers: dict[str, str], *, name: str) -> int:
    response = client.post(
        "/lists",
        headers=headers,
        json={
            "name": name,
            "type": "custom",
        },
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def add_member(
    client: TestClient,
    headers: dict[str, str],
    library_id: int,
    *,
    email: str,
    role: str,
) -> None:
    response = client.post(
        f"/libraries/{library_id}/members",
        headers=headers,
        json={
            "email": email,
            "role": role,
        },
    )
    assert response.status_code == 201


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
    collection: str | None = None,
    author_country: str | None = None,
) -> dict[str, object]:
    response = client.post(
        "/books",
        headers=headers,
        json={
            "library_id": library_id,
            "title": title,
            "authors": [author],
            "author_country_name": author_country,
            "genres": [genre],
            "collection_name": collection,
            "reading_status": reading_status,
            "user_rating": user_rating,
        },
    )
    assert response.status_code == 201
    return response.json()


def add_book_to_list(
    client: TestClient,
    headers: dict[str, str],
    list_id: int,
    book_id: int,
) -> None:
    response = client.post(
        f"/lists/{list_id}/books",
        headers=headers,
        json={"book_id": book_id},
    )
    assert response.status_code == 204


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
        collection="Cronicas de Arrakis",
        author_country="Estados Unidos",
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
    assert dune["collection"] == "Cronicas de Arrakis"
    assert dune["author_country"] == "Estados Unidos"

    reading_response = client.get("/books?reading_status=reading", headers=headers)
    assert reading_response.status_code == 200
    assert [book["title"] for book in reading_response.json()] == ["Dune"]

    rating_response = client.get("/books?min_rating=4", headers=headers)
    assert rating_response.status_code == 200
    assert {book["title"] for book in rating_response.json()} == {"Dune", "Hyperion"}

    genre_response = client.get("/books?genre=sci-fi", headers=headers)
    assert genre_response.status_code == 200
    assert {book["title"] for book in genre_response.json()} == {"Dune", "Hyperion"}

    collection_response = client.get("/books?collection=cronicas de arrakis", headers=headers)
    assert collection_response.status_code == 200
    assert [book["title"] for book in collection_response.json()] == ["Dune"]

    author_country_response = client.get("/books?author_country=estados unidos", headers=headers)
    assert author_country_response.status_code == 200
    assert [book["title"] for book in author_country_response.json()] == ["Dune"]

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
    assert copy_payload["collection"] is None
    assert copy_payload["author_country"] is None

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
            "status": "loaned",
            "physical_location": "Estanteria principal",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "loaned"
    assert update_response.json()["physical_location"] == "Estanteria principal"

    metadata_update_response = client.put(
        f"/books/{created['book_id']}/metadata",
        headers=headers,
        json={
            "title": "Neuromancer",
            "authors": ["William Gibson"],
            "author_country_name": "Estados Unidos",
            "genres": ["Cyberpunk"],
            "collection_name": "Sprawl",
            "description": "Un clasico cyberpunk.",
        },
    )
    assert metadata_update_response.status_code == 200
    assert metadata_update_response.json()["description"] == "Un clasico cyberpunk."
    assert metadata_update_response.json()["collection"] == "Sprawl"
    assert metadata_update_response.json()["author_country"] == "Estados Unidos"

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


def test_books_catalog_can_filter_by_list(client: TestClient) -> None:
    headers = register_user(client)
    personal_library_id = get_personal_library_id(client, headers)
    shared_library_id = create_library(client, headers, name="Biblioteca compartida")
    list_id = create_list(client, headers, name="Sci-Fi favorita")

    dune_personal = create_book(
        client,
        headers,
        personal_library_id,
        title="Dune",
        author="Frank Herbert",
        genre="Sci-Fi",
        reading_status="reading",
        user_rating=5,
    )
    update_personal_dune_response = client.put(
        f"/books/{dune_personal['book_id']}/metadata",
        headers=headers,
        json={"isbn": "9780441172719"},
    )
    assert update_personal_dune_response.status_code == 200
    dune_shared = client.post(
        "/books",
        headers=headers,
        json={
            "library_id": shared_library_id,
            "title": "Dune",
            "authors": ["Frank Herbert"],
            "genres": ["Sci-Fi"],
            "reading_status": "finished",
            "user_rating": 4,
            "isbn": "9780441172719",
        },
    )
    assert dune_shared.status_code == 201
    dune_shared_payload = dune_shared.json()

    hyperion = create_book(
        client,
        headers,
        personal_library_id,
        title="Hyperion",
        author="Dan Simmons",
        genre="Sci-Fi",
        reading_status="pending",
        user_rating=3,
    )

    add_book_to_list(client, headers, list_id, dune_personal["book_id"])

    filtered_response = client.get(f"/books?list_id={list_id}", headers=headers)
    assert filtered_response.status_code == 200
    filtered_payload = filtered_response.json()
    assert {(item["id"], item["title"]) for item in filtered_payload} == {
        (dune_personal["id"], "Dune"),
        (dune_shared_payload["id"], "Dune"),
    }

    combined_response = client.get(
        f"/books?list_id={list_id}&library_id={shared_library_id}&reading_status=finished&min_rating=4",
        headers=headers,
    )
    assert combined_response.status_code == 200
    assert [book["id"] for book in combined_response.json()] == [dune_shared_payload["id"]]

    non_matching_response = client.get(
        f"/books?list_id={list_id}&q=hyperion",
        headers=headers,
    )
    assert non_matching_response.status_code == 200
    assert non_matching_response.json() == []

    missing_list_response = client.get("/books?list_id=9999", headers=headers)
    assert missing_list_response.status_code == 404

    intruder_response = client.post(
        "/auth/register",
        json={
            "name": "Intruder",
            "email": "intruder@example.com",
            "password": "supersecret123",
        },
    )
    assert intruder_response.status_code == 201
    intruder_headers = {"Authorization": f"Bearer {intruder_response.json()['access_token']}"}

    forbidden_list_response = client.get(f"/books?list_id={list_id}", headers=intruder_headers)
    assert forbidden_list_response.status_code == 404

    unrelated_response = client.get("/books?list_id=9999&q=dune", headers=headers)
    assert unrelated_response.status_code == 404
    assert hyperion["title"] == "Hyperion"


def test_shared_library_roles_split_copy_and_book_permissions(client: TestClient) -> None:
    owner_headers = register_user(client)
    shared_library_id = create_library(client, owner_headers, name="Club de lectura")

    editor_response = client.post(
        "/auth/register",
        json={
            "name": "Editor",
            "email": "editor@example.com",
            "password": "supersecret123",
        },
    )
    assert editor_response.status_code == 201
    editor_headers = {"Authorization": f"Bearer {editor_response.json()['access_token']}"}

    viewer_response = client.post(
        "/auth/register",
        json={
            "name": "Viewer",
            "email": "viewer@example.com",
            "password": "supersecret123",
        },
    )
    assert viewer_response.status_code == 201
    viewer_headers = {"Authorization": f"Bearer {viewer_response.json()['access_token']}"}

    add_member(client, owner_headers, shared_library_id, email="editor@example.com", role="editor")
    add_member(client, owner_headers, shared_library_id, email="viewer@example.com", role="viewer")

    editor_book_response = client.post(
        "/books",
        headers=editor_headers,
        json={
            "library_id": shared_library_id,
            "title": "Solaris",
            "authors": ["Stanislaw Lem"],
            "genres": ["Sci-Fi"],
            "reading_status": "pending",
        },
    )
    assert editor_book_response.status_code == 201
    created_book = editor_book_response.json()

    viewer_book_response = client.post(
        "/books",
        headers=viewer_headers,
        json={
            "library_id": shared_library_id,
            "title": "Fahrenheit 451",
            "authors": ["Ray Bradbury"],
            "genres": ["Sci-Fi"],
            "reading_status": "pending",
        },
    )
    assert viewer_book_response.status_code == 403

    editor_copy_update_response = client.put(
        f"/copies/{created_book['id']}",
        headers=editor_headers,
        json={
            "status": "reserved",
        },
    )
    assert editor_copy_update_response.status_code == 200
    assert editor_copy_update_response.json()["status"] == "reserved"

    editor_metadata_update_response = client.put(
        f"/books/{created_book['book_id']}/metadata",
        headers=editor_headers,
        json={
            "title": "Solaris revisado",
        },
    )
    assert editor_metadata_update_response.status_code == 403

    owner_metadata_update_response = client.put(
        f"/books/{created_book['book_id']}/metadata",
        headers=owner_headers,
        json={
            "title": "Solaris revisado",
        },
    )
    assert owner_metadata_update_response.status_code == 200
    assert owner_metadata_update_response.json()["title"] == "Solaris revisado"
