from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.routes import external_books as external_books_route
from app.services.external_books import ExternalBookLookupNotFoundError
from app.services.external_books import ExternalBookLookupServiceError


def register_user(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "name": "Grace Hopper",
            "email": "grace@example.com",
            "password": "supersecret123",
        },
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_open_library_endpoint_success(client: TestClient, monkeypatch) -> None:
    headers = register_user(client)

    def fake_lookup(*, isbn: str | None = None, q: str | None = None) -> dict[str, object]:
        assert isbn == "9780141187761"
        assert q is None
        return {
            "title": "The Trial",
            "authors": ["Franz Kafka"],
            "publication_year": 1925,
            "isbn": "9780141187761",
            "genres": ["Classic"],
            "cover_url": "https://example.com/cover.jpg",
            "publisher_name": "Penguin",
        }

    monkeypatch.setattr(external_books_route, "lookup_open_library_book", fake_lookup)

    response = client.get(
        "/external/open-library?isbn=9780141187761",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["title"] == "The Trial"


def test_open_library_endpoint_validation(client: TestClient) -> None:
    headers = register_user(client)

    response = client.get("/external/open-library", headers=headers)
    assert response.status_code == 400

    response = client.get("/external/open-library?isbn=1&q=test", headers=headers)
    assert response.status_code == 400


def test_open_library_endpoint_not_found(client: TestClient, monkeypatch) -> None:
    headers = register_user(client)

    def fake_lookup(*, isbn: str | None = None, q: str | None = None) -> dict[str, object]:
        del isbn
        del q
        raise ExternalBookLookupNotFoundError("No se encontraron resultados en Open Library.")

    monkeypatch.setattr(external_books_route, "lookup_open_library_book", fake_lookup)

    response = client.get("/external/open-library?q=kafka", headers=headers)
    assert response.status_code == 404


def test_open_library_endpoint_bad_gateway(client: TestClient, monkeypatch) -> None:
    headers = register_user(client)

    def fake_lookup(*, isbn: str | None = None, q: str | None = None) -> dict[str, object]:
        del isbn
        del q
        raise ExternalBookLookupServiceError("No se pudo consultar Open Library en este momento.")

    monkeypatch.setattr(external_books_route, "lookup_open_library_book", fake_lookup)

    response = client.get("/external/open-library?q=kafka", headers=headers)
    assert response.status_code == 502
