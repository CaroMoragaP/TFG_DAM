from __future__ import annotations

from datetime import date
from io import BytesIO

from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.book import UserCopy
from app.schemas.external_book import ExternalBookLookupOut
from app.services import catalog_io as catalog_io_service
from app.services.external_books import ExternalBookLookupNotFoundError


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
    theme: str,
    reading_status: str,
    user_rating: int | None,
    collection: str | None = None,
    author_country: str | None = None,
    genre: str = "narrativo",
) -> dict[str, object]:
    response = client.post(
        "/books",
        headers=headers,
        json={
            "library_id": library_id,
            "title": title,
            "authors": [author],
            "author_country_name": author_country,
            "genre": genre,
            "themes": [theme] if theme else [],
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
        theme="Sci-Fi",
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
        theme="Sci-Fi",
        reading_status="pending",
        user_rating=4,
    )
    create_book(
        client,
        headers,
        shared_library_id,
        title="Emma",
        author="Jane Austen",
        theme="Clasico",
        genre="didáctico",
        reading_status="finished",
        user_rating=3,
    )

    assert dune["format"] == "physical"
    assert dune["reading_status"] == "reading"
    assert dune["user_rating"] == 5
    assert dune["collection"] == "Cronicas de Arrakis"
    assert dune["author_country"] == "Estados Unidos"
    assert dune["primary_author"] == {
        "first_name": None,
        "last_name": None,
        "display_name": "Frank Herbert",
    }

    reading_response = client.get("/books?reading_status=reading", headers=headers)
    assert reading_response.status_code == 200
    assert [book["title"] for book in reading_response.json()] == ["Dune"]

    rating_response = client.get("/books?min_rating=4", headers=headers)
    assert rating_response.status_code == 200
    assert {book["title"] for book in rating_response.json()} == {"Dune", "Hyperion"}

    genre_response = client.get("/books?genre=narrativo", headers=headers)
    assert genre_response.status_code == 200
    assert {book["title"] for book in genre_response.json()} == {"Dune", "Hyperion"}

    theme_response = client.get("/books?theme=sci-fi", headers=headers)
    assert theme_response.status_code == 200
    assert {book["title"] for book in theme_response.json()} == {"Dune", "Hyperion"}

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
        "/books?q=dune&genre=narrativo&theme=sci-fi&reading_status=reading&min_rating=5",
        headers=headers,
    )
    assert combined_response.status_code == 200
    assert [book["title"] for book in combined_response.json()] == ["Dune"]


def test_copy_detail_user_data_and_list_themes(
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
        theme="Cyberpunk",
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
            "genre": "narrativo",
            "themes": ["Ciencia ficcion"],
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

    themes_response = client.get("/themes", headers=headers)
    assert themes_response.status_code == 200
    assert "Ciencia ficci\u00f3n" in themes_response.json()
    assert "Fantas\u00eda" in themes_response.json()
    assert len(themes_response.json()) == 23

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
        theme="Sci-Fi",
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
            "genre": "narrativo",
            "themes": ["Sci-Fi"],
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
        theme="Sci-Fi",
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


def test_books_reject_invalid_or_excessive_themes(client: TestClient) -> None:
    headers = register_user(client)
    library_id = get_personal_library_id(client, headers)

    invalid_response = client.post(
        "/books",
        headers=headers,
        json={
            "library_id": library_id,
            "title": "Libro invalido",
            "authors": ["Autora"],
            "genre": "narrativo",
            "themes": ["Tema libre"],
            "reading_status": "pending",
        },
    )
    assert invalid_response.status_code == 422

    excessive_response = client.post(
        "/books",
        headers=headers,
        json={
            "library_id": library_id,
            "title": "Libro sobrecargado",
            "authors": ["Autora"],
            "genre": "narrativo",
            "themes": [
                "Fantasia",
                "Terror",
                "Humor",
                "Suspense",
            ],
            "reading_status": "pending",
        },
    )
    assert excessive_response.status_code == 422


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
            "genre": "narrativo",
            "themes": ["Sci-Fi"],
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
            "genre": "narrativo",
            "themes": ["Sci-Fi"],
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


def test_catalog_csv_preview_commit_and_export(client: TestClient, monkeypatch) -> None:
    headers = register_user(client)
    library_id = get_personal_library_id(client, headers)

    def fake_lookup_by_metadata(
        *,
        title: str,
        author: str | None = None,
        publisher: str | None = None,
    ) -> ExternalBookLookupOut:
        suffix = "ficciones" if title == "Ficciones" else "el-aleph"
        isbn = "9780307950928" if title == "Ficciones" else "9788420633121"
        return ExternalBookLookupOut(
            title=title,
            authors=[author] if author is not None else [],
            publication_year=None,
            isbn=isbn,
            themes=[],
            cover_url=f"https://example.com/{suffix}.jpg",
            publisher_name=publisher,
        )

    monkeypatch.setattr(catalog_io_service, "lookup_open_library_book_by_metadata", fake_lookup_by_metadata)

    csv_payload = (
        "Ubicación,Libro,Apellido,Nombre,Género,Editorial,Colección,Nacionalidad,Sexo\r\n"
        "Caja 1,Ficciones,Borges,Jorge Luis,Narrativo,Emecé,Biblioteca Esencial,Argentina,M\r\n"
        "Caja 2,El Aleph,Borges,Jorge Luis,Narrativo,Emecé,Biblioteca Esencial,Argentina,M\r\n"
    ).encode("utf-8")

    preview_response = client.post(
        "/books/imports/preview",
        headers=headers,
        data={"library_id": str(library_id)},
        files={"file": ("catalogo.csv", BytesIO(csv_payload), "text/csv")},
    )
    assert preview_response.status_code == 200
    preview_payload = preview_response.json()
    assert preview_payload["ready"] == 2
    assert preview_payload["duplicates"] == 0
    assert preview_payload["rows"][0]["normalized_payload"]["primary_author_first_name"] == "Jorge Luis"
    assert preview_payload["rows"][0]["normalized_payload"]["primary_author_last_name"] == "Borges"
    assert preview_payload["rows"][0]["normalized_payload"]["primary_author_display_name"] == "Jorge Luis Borges"
    assert preview_payload["rows"][0]["normalized_payload"]["authors"] == ["Jorge Luis Borges"]
    assert preview_payload["rows"][0]["normalized_payload"]["isbn"] == "9780307950928"
    assert preview_payload["rows"][0]["normalized_payload"]["cover_url"] == "https://example.com/ficciones.jpg"

    commit_response = client.post(
        "/books/imports",
        headers=headers,
        json={
            "library_id": library_id,
            "rows": preview_payload["rows"],
        },
    )
    assert commit_response.status_code == 200
    commit_payload = commit_response.json()
    assert commit_payload["imported"] == 2
    assert commit_payload["failed"] == 0

    export_response = client.get(f"/books/export?library_id={library_id}", headers=headers)
    assert export_response.status_code == 200
    assert export_response.headers["content-type"].startswith("text/csv")
    export_text = export_response.text
    assert "autor_nombre,autor_apellido,autor_display_name" in export_text
    assert "Jorge Luis,Borges,Jorge Luis Borges" in export_text
    assert "9780307950928" in export_text
    assert "https://example.com/ficciones.jpg" in export_text


def test_catalog_csv_preview_preserves_existing_isbn_and_cover_url(client: TestClient, monkeypatch) -> None:
    headers = register_user(client)
    library_id = get_personal_library_id(client, headers)

    def fail_lookup_by_metadata(**_: object) -> ExternalBookLookupOut:
        raise AssertionError("No deberia consultar Open Library cuando el CSV ya trae ISBN y portada.")

    monkeypatch.setattr(catalog_io_service, "lookup_open_library_book_by_metadata", fail_lookup_by_metadata)

    csv_payload = (
        "biblioteca,titulo,autores,autor_nombre,autor_apellido,autor_display_name,isbn,anio_publicacion,descripcion,editorial,coleccion,pais_autor,sexo_autor,genero_literario,temas,formato,ubicacion_fisica,ubicacion_digital,estado_copia,estado_lectura,valoracion,url_portada\r\n"
        "Personal,Ficciones,Jorge Luis Borges,Jorge Luis,Borges,Jorge Luis Borges,9780307950928,1944,,Emece,,,,Narrativo,,physical,Caja 1,,available,pending,,https://example.com/original.jpg\r\n"
    ).encode("utf-8")

    preview_response = client.post(
        "/books/imports/preview",
        headers=headers,
        data={"library_id": str(library_id)},
        files={"file": ("catalogo.csv", BytesIO(csv_payload), "text/csv")},
    )

    assert preview_response.status_code == 200
    payload = preview_response.json()
    assert payload["rows"][0]["normalized_payload"]["isbn"] == "9780307950928"
    assert payload["rows"][0]["normalized_payload"]["cover_url"] == "https://example.com/original.jpg"
    assert payload["rows"][0]["messages"] == []


def test_catalog_csv_preview_warns_when_open_library_has_no_confident_match(
    client: TestClient,
    monkeypatch,
) -> None:
    headers = register_user(client)
    library_id = get_personal_library_id(client, headers)

    def fake_lookup_by_metadata(**_: object) -> ExternalBookLookupOut:
        raise ExternalBookLookupNotFoundError("No se encontraron resultados fiables en Open Library.")

    monkeypatch.setattr(catalog_io_service, "lookup_open_library_book_by_metadata", fake_lookup_by_metadata)

    csv_payload = (
        "UbicaciÃ³n,Libro,Apellido,Nombre,GÃ©nero,Editorial,ColecciÃ³n,Nacionalidad,Sexo\r\n"
        "Caja 1,Ficciones,Borges,Jorge Luis,Narrativo,EmecÃ©,Biblioteca Esencial,Argentina,M\r\n"
    ).encode("utf-8")

    preview_response = client.post(
        "/books/imports/preview",
        headers=headers,
        data={"library_id": str(library_id)},
        files={"file": ("catalogo.csv", BytesIO(csv_payload), "text/csv")},
    )

    assert preview_response.status_code == 200
    payload = preview_response.json()
    assert payload["ready"] == 1
    assert payload["rows"][0]["status"] == "ready"
    assert payload["rows"][0]["normalized_payload"]["isbn"] is None
    assert payload["rows"][0]["normalized_payload"]["cover_url"] is None
    assert any("coincidencia fiable" in message for message in payload["rows"][0]["messages"])


def test_catalog_csv_preview_uses_enriched_isbn_for_duplicate_detection(
    client: TestClient,
    monkeypatch,
) -> None:
    headers = register_user(client)
    library_id = get_personal_library_id(client, headers)

    def fake_lookup_by_metadata(
        *,
        title: str,
        author: str | None = None,
        publisher: str | None = None,
    ) -> ExternalBookLookupOut:
        del author
        del publisher
        cover_suffix = "shared" if title == "Ficciones" else "shared-variant"
        return ExternalBookLookupOut(
            title=title,
            authors=["Jorge Luis Borges"],
            publication_year=None,
            isbn="9780307950928",
            themes=[],
            cover_url=f"https://example.com/{cover_suffix}.jpg",
            publisher_name="Emece",
        )

    monkeypatch.setattr(catalog_io_service, "lookup_open_library_book_by_metadata", fake_lookup_by_metadata)

    initial_csv_payload = (
        "UbicaciÃ³n,Libro,Apellido,Nombre,GÃ©nero,Editorial,ColecciÃ³n,Nacionalidad,Sexo\r\n"
        "Caja 1,Ficciones,Borges,Jorge Luis,Narrativo,EmecÃ©,Biblioteca Esencial,Argentina,M\r\n"
    ).encode("utf-8")
    initial_preview_response = client.post(
        "/books/imports/preview",
        headers=headers,
        data={"library_id": str(library_id)},
        files={"file": ("catalogo.csv", BytesIO(initial_csv_payload), "text/csv")},
    )
    assert initial_preview_response.status_code == 200

    initial_commit_response = client.post(
        "/books/imports",
        headers=headers,
        json={
            "library_id": library_id,
            "rows": initial_preview_response.json()["rows"],
        },
    )
    assert initial_commit_response.status_code == 200

    duplicate_csv_payload = (
        "UbicaciÃ³n,Libro,Apellido,Nombre,GÃ©nero,Editorial,ColecciÃ³n,Nacionalidad,Sexo\r\n"
        "Caja 2,Ficciones revisadas,Borges,Jorge Luis,Narrativo,EmecÃ©,Biblioteca Esencial,Argentina,M\r\n"
    ).encode("utf-8")
    duplicate_preview_response = client.post(
        "/books/imports/preview",
        headers=headers,
        data={"library_id": str(library_id)},
        files={"file": ("catalogo.csv", BytesIO(duplicate_csv_payload), "text/csv")},
    )

    assert duplicate_preview_response.status_code == 200
    duplicate_payload = duplicate_preview_response.json()
    assert duplicate_payload["duplicates"] == 1
    assert duplicate_payload["rows"][0]["status"] == "duplicate"
    assert "La biblioteca ya contiene un libro con esa identidad." in duplicate_payload["rows"][0]["messages"]
