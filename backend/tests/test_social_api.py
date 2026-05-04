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
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def get_personal_library_id(client: TestClient, headers: dict[str, str]) -> int:
    response = client.get("/libraries", headers=headers)
    assert response.status_code == 200
    return int(response.json()[0]["id"])


def create_shared_library(client: TestClient, headers: dict[str, str], *, name: str) -> int:
    response = client.post(
        "/libraries",
        headers=headers,
        json={"name": name, "type": "shared"},
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
        json={"email": email, "role": role},
    )
    assert response.status_code == 201


def create_book(
    client: TestClient,
    headers: dict[str, str],
    *,
    library_id: int,
    title: str,
) -> dict[str, object]:
    response = client.post(
        "/books",
        headers=headers,
        json={
            "library_id": library_id,
            "title": title,
            "authors": ["Octavia E. Butler"],
            "genre": "narrativo",
            "themes": ["Sci-Fi"],
            "reading_status": "pending",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_shared_library_community_reviews_reading_events_and_summary(client: TestClient) -> None:
    owner_headers = register_user(client, name="Owner", email="owner-social@example.com")
    viewer_headers = register_user(client, name="Viewer", email="viewer-social@example.com")

    library_id = create_shared_library(client, owner_headers, name="Club Octavia")
    add_member(
        client,
        owner_headers,
        library_id=library_id,
        email="viewer-social@example.com",
        role="viewer",
    )

    created = create_book(client, owner_headers, library_id=library_id, title="Parable of the Sower")

    start_reading_response = client.put(
        f"/copies/{created['id']}/user-data",
        headers=viewer_headers,
        json={"reading_status": "reading", "rating": 5},
    )
    assert start_reading_response.status_code == 200

    community_response = client.get(f"/copies/{created['id']}/community", headers=owner_headers)
    assert community_response.status_code == 200
    community_payload = community_response.json()
    assert community_payload["shared_readers_count"] == 1
    assert community_payload["shared_readers"] == [
        {
            "user_id": 2,
            "name": "Viewer",
        },
    ]
    assert community_payload["public_review_count"] == 0
    assert community_payload["active_loan"] is None

    review_response = client.post(
        f"/copies/{created['id']}/reviews",
        headers=viewer_headers,
        json={},
    )
    assert review_response.status_code == 201
    review_payload = review_response.json()
    assert review_payload["rating"] == 5
    assert review_payload["body"] is None

    duplicate_review_response = client.post(
        f"/copies/{created['id']}/reviews",
        headers=viewer_headers,
        json={"body": "Duplicada"},
    )
    assert duplicate_review_response.status_code == 409

    updated_review_response = client.patch(
        f"/reviews/{review_payload['id']}",
        headers=viewer_headers,
        json={"body": "Una distopia imprescindible."},
    )
    assert updated_review_response.status_code == 200
    assert updated_review_response.json()["body"] == "Una distopia imprescindible."

    finish_reading_response = client.put(
        f"/copies/{created['id']}/user-data",
        headers=viewer_headers,
        json={"reading_status": "finished"},
    )
    assert finish_reading_response.status_code == 200

    reviews_response = client.get(f"/copies/{created['id']}/reviews", headers=owner_headers)
    assert reviews_response.status_code == 200
    reviews_payload = reviews_response.json()
    assert len(reviews_payload) == 1
    assert reviews_payload[0]["user_name"] == "Viewer"
    assert reviews_payload[0]["rating"] == 5

    detail_response = client.get(f"/copies/{created['id']}", headers=owner_headers)
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["shared_readers_count"] == 0
    assert detail_payload["public_review_count"] == 1
    assert detail_payload["public_average_rating"] == 5.0

    catalog_response = client.get(f"/books?library_id={library_id}", headers=owner_headers)
    assert catalog_response.status_code == 200
    catalog_payload = catalog_response.json()
    assert catalog_payload[0]["public_review_count"] == 1
    assert catalog_payload[0]["public_average_rating"] == 5.0

    activity_response = client.get(f"/libraries/{library_id}/activity", headers=owner_headers)
    assert activity_response.status_code == 200
    activity_payload = activity_response.json()
    assert activity_payload["total"] == 5
    assert [item["id"] for item in activity_payload["items"]] == sorted(
        [item["id"] for item in activity_payload["items"]],
        reverse=True,
    )
    assert {item["event_type"] for item in activity_payload["items"]} == {
        "book_added",
        "reading_started",
        "review_published",
        "review_updated",
        "reading_finished",
    }

    library_reviews_response = client.get(f"/libraries/{library_id}/reviews?filter=all&sort=recent", headers=owner_headers)
    assert library_reviews_response.status_code == 200
    library_reviews_payload = library_reviews_response.json()
    assert library_reviews_payload["total"] == 1
    assert library_reviews_payload["items"][0]["public_review_count"] == 1
    assert library_reviews_payload["items"][0]["other_reviews"][0]["user_name"] == "Viewer"


def test_public_review_follows_canonical_user_rating_and_requires_unpublish_to_clear_it(
    client: TestClient,
) -> None:
    owner_headers = register_user(client, name="Owner", email="owner-sync@example.com")
    reviewer_headers = register_user(client, name="Reviewer", email="reviewer-sync@example.com")

    library_id = create_shared_library(client, owner_headers, name="Sincronizacion")
    add_member(
        client,
        owner_headers,
        library_id=library_id,
        email="reviewer-sync@example.com",
        role="viewer",
    )
    created = create_book(client, owner_headers, library_id=library_id, title="Patternmaster")

    missing_rating_publish_response = client.post(
        f"/copies/{created['id']}/reviews",
        headers=reviewer_headers,
        json={"body": "No deberia publicarse aun."},
    )
    assert missing_rating_publish_response.status_code == 409

    initial_rating_response = client.put(
        f"/copies/{created['id']}/user-data",
        headers=reviewer_headers,
        json={"rating": 5},
    )
    assert initial_rating_response.status_code == 200

    publish_response = client.post(
        f"/copies/{created['id']}/reviews",
        headers=reviewer_headers,
        json={"body": "Una lectura contundente."},
    )
    assert publish_response.status_code == 201
    review_payload = publish_response.json()
    assert review_payload["rating"] == 5

    rating_sync_response = client.put(
        f"/copies/{created['id']}/user-data",
        headers=reviewer_headers,
        json={"rating": 4},
    )
    assert rating_sync_response.status_code == 200
    assert rating_sync_response.json()["rating"] == 4

    synced_reviews_response = client.get(f"/copies/{created['id']}/reviews", headers=owner_headers)
    assert synced_reviews_response.status_code == 200
    assert synced_reviews_response.json()[0]["rating"] == 4

    blocked_clear_response = client.put(
        f"/copies/{created['id']}/user-data",
        headers=reviewer_headers,
        json={"rating": None},
    )
    assert blocked_clear_response.status_code == 409

    delete_response = client.delete(f"/reviews/{review_payload['id']}", headers=reviewer_headers)
    assert delete_response.status_code == 204

    clear_response = client.put(
        f"/copies/{created['id']}/user-data",
        headers=reviewer_headers,
        json={"rating": None},
    )
    assert clear_response.status_code == 200
    assert clear_response.json()["rating"] is None

    my_reviews_response = client.get(
        f"/libraries/{library_id}/reviews?filter=mine&sort=recent",
        headers=reviewer_headers,
    )
    assert my_reviews_response.status_code == 200
    assert my_reviews_response.json()["total"] == 0


def test_shared_library_loans_permissions_and_history(client: TestClient) -> None:
    owner_headers = register_user(client, name="Owner", email="owner-loans@example.com")
    editor_headers = register_user(client, name="Editor", email="editor-loans@example.com")
    viewer_headers = register_user(client, name="Viewer", email="viewer-loans@example.com")

    library_id = create_shared_library(client, owner_headers, name="Prestamos")
    add_member(client, owner_headers, library_id=library_id, email="editor-loans@example.com", role="editor")
    add_member(client, owner_headers, library_id=library_id, email="viewer-loans@example.com", role="viewer")

    created = create_book(client, owner_headers, library_id=library_id, title="Kindred")

    viewer_loan_response = client.post(
        f"/copies/{created['id']}/loans",
        headers=viewer_headers,
        json={"borrower_name": "Marta"},
    )
    assert viewer_loan_response.status_code == 403

    internal_loan_response = client.post(
        f"/copies/{created['id']}/loans",
        headers=editor_headers,
        json={"borrower_user_id": 3, "due_date": "2026-05-12"},
    )
    assert internal_loan_response.status_code == 201
    internal_loan_payload = internal_loan_response.json()
    assert internal_loan_payload["is_internal"] is True
    assert internal_loan_payload["borrower_name"] == "Viewer"
    assert internal_loan_payload["due_date"] == "2026-05-12"

    duplicate_loan_response = client.post(
        f"/copies/{created['id']}/loans",
        headers=owner_headers,
        json={"borrower_name": "Externo"},
    )
    assert duplicate_loan_response.status_code == 409

    blocked_status_update_response = client.put(
        f"/copies/{created['id']}",
        headers=owner_headers,
        json={"status": "available"},
    )
    assert blocked_status_update_response.status_code == 409

    active_detail_response = client.get(f"/copies/{created['id']}", headers=owner_headers)
    assert active_detail_response.status_code == 200
    assert active_detail_response.json()["active_loan"]["borrower_name"] == "Viewer"

    return_response = client.post(
        f"/loans/{internal_loan_payload['id']}/return",
        headers=owner_headers,
    )
    assert return_response.status_code == 200
    assert return_response.json()["returned_at"] is not None

    external_loan_response = client.post(
        f"/copies/{created['id']}/loans",
        headers=owner_headers,
        json={"borrower_name": "Marta", "notes": "Prestamo externo"},
    )
    assert external_loan_response.status_code == 201
    external_loan_payload = external_loan_response.json()
    assert external_loan_payload["is_internal"] is False
    assert external_loan_payload["borrower_name"] == "Marta"
    assert external_loan_payload["notes"] == "Prestamo externo"

    loans_response = client.get(f"/copies/{created['id']}/loans", headers=viewer_headers)
    assert loans_response.status_code == 200
    loans_payload = loans_response.json()
    assert len(loans_payload) == 2
    assert loans_payload[0]["id"] == external_loan_payload["id"]
    assert loans_payload[1]["id"] == internal_loan_payload["id"]
    assert loans_payload[1]["returned_at"] is not None

    activity_response = client.get(f"/libraries/{library_id}/activity", headers=owner_headers)
    assert activity_response.status_code == 200
    activity_types = [item["event_type"] for item in activity_response.json()["items"]]
    assert activity_types.count("loan_started") == 2
    assert activity_types.count("loan_returned") == 1


def test_community_endpoints_require_membership_and_shared_library(client: TestClient) -> None:
    owner_headers = register_user(client, name="Owner", email="owner-guard@example.com")
    outsider_headers = register_user(client, name="Outsider", email="outsider-guard@example.com")

    shared_library_id = create_shared_library(client, owner_headers, name="Guardias")
    shared_book = create_book(client, owner_headers, library_id=shared_library_id, title="Wild Seed")

    outsider_reviews_response = client.get(
        f"/copies/{shared_book['id']}/reviews",
        headers=outsider_headers,
    )
    assert outsider_reviews_response.status_code == 403

    outsider_activity_response = client.get(
        f"/libraries/{shared_library_id}/activity",
        headers=outsider_headers,
    )
    assert outsider_activity_response.status_code == 403

    personal_library_id = get_personal_library_id(client, owner_headers)
    personal_book = create_book(client, owner_headers, library_id=personal_library_id, title="Fledgling")

    personal_reviews_response = client.get(
        f"/copies/{personal_book['id']}/reviews",
        headers=owner_headers,
    )
    assert personal_reviews_response.status_code == 404

    personal_activity_response = client.get(
        f"/libraries/{personal_library_id}/activity",
        headers=owner_headers,
    )
    assert personal_activity_response.status_code == 404
