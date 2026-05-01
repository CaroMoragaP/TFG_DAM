from __future__ import annotations

from datetime import date
from datetime import timedelta

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
    return int(response.json()[0]["id"])


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


def add_member(
    client: TestClient,
    headers: dict[str, str],
    *,
    library_id: int,
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
    *,
    library_id: int,
    title: str,
    author: str,
    genre: str,
    reading_status: str = "pending",
    user_rating: int | None = None,
    author_country: str | None = None,
    author_sex: str | None = None,
    publisher_name: str | None = None,
    publication_year: int | None = None,
    format: str = "physical",
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
            "author_country_name": author_country,
            "author_sex": author_sex,
            "publisher_name": publisher_name,
            "publication_year": publication_year,
            "format": format,
        },
    )
    assert response.status_code == 201
    return response.json()


def update_user_copy(
    client: TestClient,
    headers: dict[str, str],
    *,
    copy_id: int,
    reading_status: str | None = None,
    rating: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> None:
    payload: dict[str, object | None] = {}
    if reading_status is not None:
        payload["reading_status"] = reading_status
    if rating is not None:
        payload["rating"] = rating
    if start_date is not None:
        payload["start_date"] = start_date
    if end_date is not None:
        payload["end_date"] = end_date

    response = client.put(
        f"/copies/{copy_id}/user-data",
        headers=headers,
        json=payload,
    )
    assert response.status_code == 200


def update_reading_goal(
    client: TestClient,
    headers: dict[str, str],
    *,
    year: int,
    target_books: int,
) -> dict[str, object]:
    response = client.put(
        "/stats/reading-goal",
        headers=headers,
        json={
            "year": year,
            "target_books": target_books,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_stats_endpoints_aggregate_catalog_and_reading_views(
    client: TestClient,
) -> None:
    current_year = date.today().year
    owner_headers = register_user(client, name="Ada", email="ada@example.com")
    personal_library_id = get_personal_library_id(client, owner_headers)
    shared_library_id = create_library(client, owner_headers, name="Club de lectura")

    viewer_headers = register_user(client, name="Linus", email="linus@example.com")
    add_member(
        client,
        owner_headers,
        library_id=shared_library_id,
        email="linus@example.com",
        role="viewer",
    )

    dune = create_book(
        client,
        owner_headers,
        library_id=personal_library_id,
        title="Dune",
        author="Frank Herbert",
        genre="Sci-Fi",
        reading_status="reading",
        user_rating=5,
        author_country="Estados Unidos",
        author_sex="male",
        publisher_name="Ace",
        publication_year=1965,
        format="physical",
    )
    update_user_copy(
        client,
        owner_headers,
        copy_id=int(dune["id"]),
        reading_status="finished",
        rating=5,
        start_date="2025-01-10",
        end_date="2025-02-01",
    )

    hyperion = create_book(
        client,
        owner_headers,
        library_id=personal_library_id,
        title="Hyperion",
        author="Dan Simmons",
        genre="Sci-Fi",
        reading_status="pending",
        author_country="Estados Unidos",
        author_sex="male",
        publisher_name="Bantam",
        publication_year=1989,
        format="digital",
    )
    assert hyperion["title"] == "Hyperion"

    emma = create_book(
        client,
        owner_headers,
        library_id=shared_library_id,
        title="Emma",
        author="Jane Austen",
        genre="Clasico",
        reading_status="finished",
        user_rating=4,
        author_country="Reino Unido",
        author_sex="female",
        publisher_name="Penguin",
        publication_year=1815,
        format="physical",
    )
    update_user_copy(
        client,
        owner_headers,
        copy_id=int(emma["id"]),
        reading_status="finished",
        rating=4,
        start_date="2026-02-01",
        end_date="2026-03-05",
    )

    create_book(
        client,
        owner_headers,
        library_id=shared_library_id,
        title="Project Hail Mary",
        author="Andy Weir",
        genre="Sci-Fi",
        reading_status="reading",
        author_country="Estados Unidos",
        author_sex="male",
        publisher_name="Ballantine",
        publication_year=2021,
        format="digital",
    )

    for index in range(1, 10):
        create_book(
            client,
            owner_headers,
            library_id=personal_library_id,
            title=f"Libro editorial {index}",
            author="Autor repetido" if index <= 3 else f"Autor {index}",
            genre="Ensayo",
            author_sex="unknown",
            publisher_name=f"Editorial {index}",
            publication_year=2000 + index,
            format="physical" if index % 2 == 0 else "digital",
        )

    create_book(
        client,
        owner_headers,
        library_id=personal_library_id,
        title="Sin genero",
        author="Autor sin datos",
        genre="",
        author_country=None,
        author_sex=None,
        publisher_name=None,
        publication_year=None,
        format="physical",
    )

    catalog_response = client.get("/stats/catalog", headers=owner_headers)
    assert catalog_response.status_code == 200
    catalog_payload = catalog_response.json()
    assert catalog_payload["totals"] == {
        "total": 14,
        "physical": 7,
        "digital": 7,
    }
    assert catalog_payload["author_sex_distribution"][0]["key"] == "male"
    assert catalog_payload["author_sex_distribution"][0]["count"] == 3
    assert catalog_payload["author_sex_distribution"][1]["key"] == "female"
    assert catalog_payload["author_sex_distribution"][1]["count"] == 1
    assert catalog_payload["author_sex_distribution"][3]["key"] == "unknown"
    assert catalog_payload["author_sex_distribution"][3]["count"] == 10
    assert any(
        item["label"] == "Sin pais" and item["count"] == 10
        for item in catalog_payload["author_country_distribution"]
    )
    assert any(
        item["label"] == "Sin genero" and item["count"] == 1
        for item in catalog_payload["genre_distribution"]
    )
    assert any(
        item["label"] == "Otros" and item["count"] == 4
        for item in catalog_payload["publisher_distribution"]
    )
    assert catalog_payload["top_authors"][0] == {"label": "Autor repetido", "count": 3}
    assert catalog_payload["top_genres"][0] == {"label": "Ensayo", "count": 9}

    scoped_catalog_response = client.get(
        f"/stats/catalog?library_id={shared_library_id}",
        headers=owner_headers,
    )
    assert scoped_catalog_response.status_code == 200
    assert scoped_catalog_response.json()["totals"] == {
        "total": 2,
        "physical": 1,
        "digital": 1,
    }

    reading_response = client.get("/stats/reading", headers=owner_headers)
    assert reading_response.status_code == 200
    reading_payload = reading_response.json()
    assert reading_payload["status_counts"] == {
        "pending": 11,
        "reading": 1,
        "finished": 2,
    }
    assert reading_payload["goal_year"] == current_year
    assert reading_payload["goal"] is None
    assert reading_payload["goal_progress"] == {
        "target": 0,
        "completed": 1,
        "percentage": 0.0,
    }
    assert reading_payload["monthly_progress"][1] == {
        "month": "Feb",
        "started": 1,
        "finished": 0,
    }
    assert reading_payload["monthly_progress"][2] == {
        "month": "Mar",
        "started": 0,
        "finished": 1,
    }
    assert reading_payload["streak"] == {
        "current_months": 0,
        "best_months": 1,
    }
    assert reading_payload["stuck_reminders"] == []
    assert reading_payload["finished_by_year"] == [
        {"year": 2025, "count": 1},
        {"year": 2026, "count": 1},
    ]
    assert reading_payload["rating_summary"]["average"] == 4.5
    assert reading_payload["rating_summary"]["total_rated"] == 2
    assert any(
        item["rating"] == 5 and item["count"] == 1
        for item in reading_payload["rating_summary"]["distribution"]
    )
    assert reading_payload["reading_activity"] == {
        "started": 2,
        "finished": 2,
        "missing_dates": 12,
    }
    assert [item["title"] for item in reading_payload["recent_finishes"]] == [
        "Emma",
        "Dune",
    ]

    scoped_reading_response = client.get(
        f"/stats/reading?library_id={personal_library_id}",
        headers=owner_headers,
    )
    assert scoped_reading_response.status_code == 200
    scoped_reading_payload = scoped_reading_response.json()
    assert scoped_reading_payload["status_counts"] == {
        "pending": 11,
        "reading": 0,
        "finished": 1,
    }
    assert scoped_reading_payload["goal_progress"] == {
        "target": 0,
        "completed": 1,
        "percentage": 0.0,
    }
    assert scoped_reading_payload["monthly_progress"][1]["started"] == 0
    assert scoped_reading_payload["monthly_progress"][2]["finished"] == 0

    forbidden_stats_response = client.get(
        f"/stats/catalog?library_id={personal_library_id}",
        headers=viewer_headers,
    )
    assert forbidden_stats_response.status_code == 403

    missing_stats_response = client.get("/stats/reading?library_id=9999", headers=owner_headers)
    assert missing_stats_response.status_code == 404

    archive_response = client.post(
        f"/libraries/{shared_library_id}/archive",
        headers=owner_headers,
    )
    assert archive_response.status_code == 200

    archived_stats_response = client.get(
        f"/stats/catalog?library_id={shared_library_id}",
        headers=owner_headers,
    )
    assert archived_stats_response.status_code == 409


def test_reading_goal_endpoint_and_extended_reading_stats(
    client: TestClient,
) -> None:
    today = date.today()
    current_year = today.year
    stuck_start = (today - timedelta(days=45)).isoformat()
    fresh_start = (today - timedelta(days=7)).isoformat()
    headers = register_user(client, name="Goal User", email="goals@example.com")
    library_id = get_personal_library_id(client, headers)

    january = create_book(
        client,
        headers,
        library_id=library_id,
        title="January Finish",
        author="Autor Uno",
        genre="Ensayo",
        reading_status="finished",
    )
    update_user_copy(
        client,
        headers,
        copy_id=int(january["id"]),
        reading_status="finished",
        start_date=f"{current_year}-01-03",
        end_date=f"{current_year}-01-20",
    )

    february = create_book(
        client,
        headers,
        library_id=library_id,
        title="February Finish",
        author="Autor Dos",
        genre="Ensayo",
        reading_status="finished",
    )
    update_user_copy(
        client,
        headers,
        copy_id=int(february["id"]),
        reading_status="finished",
        start_date=f"{current_year}-02-01",
        end_date=f"{current_year}-02-28",
    )

    april = create_book(
        client,
        headers,
        library_id=library_id,
        title="April Finish",
        author="Autor Tres",
        genre="Ensayo",
        reading_status="finished",
    )
    update_user_copy(
        client,
        headers,
        copy_id=int(april["id"]),
        reading_status="finished",
        start_date=f"{current_year}-04-05",
        end_date=f"{current_year}-04-18",
    )

    create_book(
        client,
        headers,
        library_id=library_id,
        title="Old Finish",
        author="Autor Cuatro",
        genre="Ensayo",
        reading_status="finished",
    )

    stuck = create_book(
        client,
        headers,
        library_id=library_id,
        title="Stuck Book",
        author="Autor Cinco",
        genre="Drama",
        reading_status="reading",
    )
    update_user_copy(
        client,
        headers,
        copy_id=int(stuck["id"]),
        reading_status="reading",
        start_date=stuck_start,
    )

    fresh = create_book(
        client,
        headers,
        library_id=library_id,
        title="Fresh Reading",
        author="Autor Seis",
        genre="Drama",
        reading_status="reading",
    )
    update_user_copy(
        client,
        headers,
        copy_id=int(fresh["id"]),
        reading_status="reading",
        start_date=fresh_start,
    )

    goal_payload = update_reading_goal(
        client,
        headers,
        year=current_year,
        target_books=12,
    )
    assert goal_payload == {
        "year": current_year,
        "target_books": 12,
    }

    updated_goal_payload = update_reading_goal(
        client,
        headers,
        year=current_year,
        target_books=18,
    )
    assert updated_goal_payload == {
        "year": current_year,
        "target_books": 18,
    }

    reading_response = client.get("/stats/reading", headers=headers)
    assert reading_response.status_code == 200
    reading_payload = reading_response.json()
    assert reading_payload["goal"] == {
        "year": current_year,
        "target_books": 18,
    }
    assert reading_payload["goal_progress"] == {
        "target": 18,
        "completed": 3,
        "percentage": 16.67,
    }
    assert reading_payload["monthly_progress"][:4] == [
        {"month": "Ene", "started": 1, "finished": 1},
        {"month": "Feb", "started": 1, "finished": 1},
        {"month": "Mar", "started": 1, "finished": 0},
        {"month": "Abr", "started": 2, "finished": 1},
    ]
    assert reading_payload["streak"] == {
        "current_months": 0,
        "best_months": 2,
    }
    assert [item["title"] for item in reading_payload["stuck_reminders"]] == ["Stuck Book"]
    assert reading_payload["stuck_reminders"][0]["days_open"] >= 30
    assert reading_payload["recent_finishes"][0]["title"] == "April Finish"


def test_book_endpoints_persist_author_sex(
    client: TestClient,
) -> None:
    headers = register_user(client, name="Grace", email="grace@example.com")
    library_id = get_personal_library_id(client, headers)

    created = create_book(
        client,
        headers,
        library_id=library_id,
        title="Neuromancer",
        author="William Gibson",
        genre="Cyberpunk",
        author_country="Canada",
        author_sex="male",
    )
    assert created["author_sex"] == "male"

    metadata_update_response = client.put(
        f"/books/{created['book_id']}/metadata",
        headers=headers,
        json={
            "title": "Neuromancer",
            "authors": ["William Gibson"],
            "genres": ["Cyberpunk"],
            "author_country_name": "Canada",
            "author_sex": "male",
        },
    )
    assert metadata_update_response.status_code == 200
    assert metadata_update_response.json()["author_sex"] == "male"

    copy_response = client.get(f"/copies/{created['id']}", headers=headers)
    assert copy_response.status_code == 200
    assert copy_response.json()["author_sex"] == "male"
