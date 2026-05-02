from __future__ import annotations

import csv
from io import StringIO
from typing import Any
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.author_names import build_structured_author_name
from app.core.author_names import is_placeholder_author
from app.core.author_names import normalize_author_lookup_key
from app.core.themes import map_theme_candidates
from app.models.book import Author
from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import Copy
from app.models.library import Library
from app.models.enums import UserLibraryRole
from app.schemas.book import BookCreate
from app.schemas.catalog_io import CatalogImportCommitIn
from app.schemas.catalog_io import CatalogImportCommitOut
from app.schemas.catalog_io import CatalogImportPreviewOut
from app.schemas.catalog_io import CatalogImportPreviewRowOut
from app.schemas.catalog_io import CatalogImportResultRowOut
from app.schemas.catalog_io import CatalogImportRowPayload
from app.services.books import COPY_LOAD_OPTIONS
from app.services.books import DuplicateBookCopyError
from app.services.books import create_book_in_transaction
from app.services.books import list_books
from app.services.external_books import ExternalBookLookupNotFoundError
from app.services.external_books import ExternalBookLookupServiceError
from app.services.external_books import lookup_open_library_book_by_metadata
from app.services.libraries import CATALOG_MANAGEMENT_ROLES
from app.services.libraries import READ_ACCESS_ROLES
from app.services.libraries import get_accessible_library
from app.services.user_copies import get_or_create_user_copy

REFERENCE_HEADER_SET = {
    "ubicacion",
    "libro",
    "apellido",
    "nombre",
    "genero",
    "editorial",
    "coleccion",
    "nacionalidad",
    "sexo",
}
NATIVE_HEADER_SET = {
    "biblioteca",
    "titulo",
    "autores",
    "autor_nombre",
    "autor_apellido",
    "autor_display_name",
    "isbn",
    "anio_publicacion",
    "descripcion",
    "editorial",
    "coleccion",
    "pais_autor",
    "sexo_autor",
    "genero_literario",
    "temas",
    "formato",
    "ubicacion_fisica",
    "ubicacion_digital",
    "estado_copia",
    "estado_lectura",
    "valoracion",
    "url_portada",
}
EXPORT_FIELDNAMES = [
    "biblioteca",
    "titulo",
    "autores",
    "autor_nombre",
    "autor_apellido",
    "autor_display_name",
    "isbn",
    "anio_publicacion",
    "descripcion",
    "editorial",
    "coleccion",
    "pais_autor",
    "sexo_autor",
    "genero_literario",
    "temas",
    "formato",
    "ubicacion_fisica",
    "ubicacion_digital",
    "estado_copia",
    "estado_lectura",
    "valoracion",
    "url_portada",
]
_COPY_STATUS_VALUES = {"available", "loaned", "reserved"}
_READING_STATUS_VALUES = {"pending", "reading", "finished"}
_COPY_FORMAT_VALUES = {"physical", "digital"}


def preview_catalog_import(
    db: Session,
    *,
    user_id: int,
    library_id: int,
    file_bytes: bytes,
) -> CatalogImportPreviewOut:
    get_accessible_library(
        db,
        user_id=user_id,
        library_id=library_id,
        allowed_roles=CATALOG_MANAGEMENT_ROLES,
    )

    rows = _read_csv_rows(file_bytes)
    existing_keys = _existing_library_duplicate_keys(db, library_id=library_id)
    file_keys: set[tuple[str, str]] = set()
    preview_rows: list[CatalogImportPreviewRowOut] = []
    ready_count = 0
    duplicate_count = 0
    invalid_count = 0

    for row_number, row in rows:
        try:
            payload = _build_payload_for_row(row)
            messages: list[str] = []
            payload = _enrich_payload_from_open_library(payload, messages)
            _validate_payload(payload)
            duplicate_key = _build_duplicate_key(payload)
            status = "ready"

            if duplicate_key is not None and duplicate_key in existing_keys:
                status = "duplicate"
                messages.append("La biblioteca ya contiene un libro con esa identidad.")
            elif duplicate_key is not None and duplicate_key in file_keys:
                status = "duplicate"
                messages.append("La fila duplica otro libro del mismo archivo.")

            if status == "ready" and duplicate_key is not None:
                file_keys.add(duplicate_key)

            preview_rows.append(
                CatalogImportPreviewRowOut(
                    row_number=row_number,
                    status=status,
                    messages=messages,
                    normalized_payload=payload,
                ),
            )
            if status == "ready":
                ready_count += 1
            else:
                duplicate_count += 1
        except ValueError as exc:
            preview_rows.append(
                CatalogImportPreviewRowOut(
                    row_number=row_number,
                    status="invalid",
                    messages=[str(exc)],
                    normalized_payload=None,
                ),
            )
            invalid_count += 1

    return CatalogImportPreviewOut(
        total=len(preview_rows),
        ready=ready_count,
        duplicates=duplicate_count,
        invalid=invalid_count,
        rows=preview_rows,
    )


def commit_catalog_import(
    db: Session,
    *,
    user_id: int,
    payload: CatalogImportCommitIn,
) -> CatalogImportCommitOut:
    get_accessible_library(
        db,
        user_id=user_id,
        library_id=payload.library_id,
        allowed_roles=CATALOG_MANAGEMENT_ROLES,
    )

    results: list[CatalogImportResultRowOut] = []
    imported = 0
    skipped_duplicates = 0
    failed = 0

    for row in payload.rows:
        if row.status != "ready" or row.normalized_payload is None:
            continue

        try:
            book_create = BookCreate.model_validate(
                {
                    "library_id": payload.library_id,
                    **row.normalized_payload.model_dump(),
                },
            )
            with db.begin_nested():
                copy = create_book_in_transaction(db, user_id=user_id, data=book_create)
                get_or_create_user_copy(
                    db,
                    user_id=user_id,
                    copy_id=copy.id,
                    seed_reading_status=book_create.reading_status,
                    seed_rating=book_create.user_rating,
                )
            results.append(
                CatalogImportResultRowOut(
                    row_number=row.row_number,
                    status="imported",
                    messages=[],
                    copy_id=copy.id,
                    book_id=copy.book_id,
                ),
            )
            imported += 1
        except DuplicateBookCopyError as exc:
            results.append(
                CatalogImportResultRowOut(
                    row_number=row.row_number,
                    status="skipped_duplicate",
                    messages=[str(exc)],
                ),
            )
            skipped_duplicates += 1
        except Exception as exc:
            results.append(
                CatalogImportResultRowOut(
                    row_number=row.row_number,
                    status="failed",
                    messages=[str(exc)],
                ),
            )
            failed += 1

    db.commit()
    return CatalogImportCommitOut(
        imported=imported,
        skipped_duplicates=skipped_duplicates,
        failed=failed,
        results=results,
    )


def export_catalog_csv(
    db: Session,
    *,
    user_id: int,
    library_id: int | None = None,
    list_id: int | None = None,
    q: str | None = None,
    genre: str | None = None,
    theme: str | None = None,
    collection: str | None = None,
    author_country: str | None = None,
    reading_status=None,
    min_rating: int | None = None,
) -> tuple[str, str]:
    copies = list_books(
        db,
        user_id=user_id,
        library_id=library_id,
        list_id=list_id,
        q=q,
        genre=genre,
        theme=theme,
        collection=collection,
        author_country=author_country,
        reading_status=reading_status,
        min_rating=min_rating,
    )
    library_map = {
        library.id: library.name
        for library in db.scalars(
            select(Library).where(Library.id.in_({copy.library_id for copy in copies})),
        ).all()
    } if copies else {}

    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=EXPORT_FIELDNAMES)
    writer.writeheader()

    for copy in copies:
        primary_author = _get_primary_author(copy.book)
        writer.writerow(
            {
                "biblioteca": library_map.get(copy.library_id, ""),
                "titulo": copy.book.title,
                "autores": " | ".join(_serialize_authors(copy.book)),
                "autor_nombre": primary_author.first_name if primary_author is not None else "",
                "autor_apellido": primary_author.last_name if primary_author is not None else "",
                "autor_display_name": primary_author.display_name if primary_author is not None else "",
                "isbn": copy.book.isbn or "",
                "anio_publicacion": copy.book.publication_year or "",
                "descripcion": copy.book.description or "",
                "editorial": copy.book.publisher.name if copy.book.publisher is not None else "",
                "coleccion": copy.book.collection.name if copy.book.collection is not None else "",
                "genero_literario": copy.book.genre or "",
                "pais_autor": primary_author.country.name
                if primary_author is not None and primary_author.country is not None
                else "",
                "sexo_autor": primary_author.sex if primary_author is not None and primary_author.sex is not None else "",
                "temas": " | ".join(
                    relation.theme.name
                    for relation in sorted(copy.book.book_themes, key=lambda item: item.theme.name.casefold())
                ),
                "formato": copy.format.value,
                "ubicacion_fisica": copy.physical_location or "",
                "ubicacion_digital": copy.digital_location or "",
                "estado_copia": copy.status.value,
                "estado_lectura": getattr(copy, "_catalog_reading_status").value,
                "valoracion": getattr(copy, "_catalog_user_rating") or "",
                "url_portada": copy.book.cover_url or "",
            },
        )

    filename = "catalogo.csv" if library_id is None else f"catalogo-biblioteca-{library_id}.csv"
    return buffer.getvalue(), filename


def _read_csv_rows(file_bytes: bytes) -> list[tuple[int, dict[str, str]]]:
    decoded = None
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            decoded = file_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if decoded is None:
        raise ValueError("No se pudo leer el CSV con una codificacion compatible.")

    decoded = _repair_mojibake_text(decoded)

    reader = csv.DictReader(StringIO(decoded))
    if reader.fieldnames is None:
        raise ValueError("El archivo CSV no incluye cabeceras.")

    return [
        (index, {key: (value or "") for key, value in row.items()})
        for index, row in enumerate(reader, start=2)
    ]


def _build_payload_for_row(row: dict[str, str]) -> CatalogImportRowPayload:
    header_keys = {_normalize_header(header) for header in row.keys()}
    if REFERENCE_HEADER_SET.issubset(header_keys):
        return _build_reference_payload(row)
    if {"titulo", "autor_display_name", "autores"}.issubset(header_keys):
        return _build_native_payload(row)
    raise ValueError("El CSV no coincide con un formato de importacion soportado.")


def _build_reference_payload(row: dict[str, str]) -> CatalogImportRowPayload:
    indexed_row = _normalize_row_keys(row)
    structured_author = build_structured_author_name(
        first_name=indexed_row.get("nombre"),
        last_name=indexed_row.get("apellido"),
    )
    authors = [structured_author.display_name] if structured_author.display_name is not None else []

    return CatalogImportRowPayload(
        title=_required_text(indexed_row.get("libro"), "El titulo es obligatorio."),
        publisher_name=_optional_text(indexed_row.get("editorial")),
        collection_name=_optional_text(indexed_row.get("coleccion")),
        author_country_name=_optional_text(indexed_row.get("nacionalidad")),
        author_sex=_optional_text(indexed_row.get("sexo")),
        primary_author_first_name=structured_author.first_name,
        primary_author_last_name=structured_author.last_name,
        primary_author_display_name=structured_author.display_name,
        authors=authors,
        genre=_optional_text(indexed_row.get("genero_literario")),
        themes=map_theme_candidates(
            [indexed_row["genero"].strip()] if _optional_text(indexed_row.get("genero")) else [],
        ),
        physical_location=_optional_text(indexed_row.get("ubicacion")),
    )


def _build_native_payload(row: dict[str, str]) -> CatalogImportRowPayload:
    indexed_row = _repair_shifted_native_row(_normalize_row_keys(row))
    structured_author = build_structured_author_name(
        first_name=indexed_row.get("autor_nombre"),
        last_name=indexed_row.get("autor_apellido"),
        display_name=indexed_row.get("autor_display_name"),
    )
    legacy_authors = _split_pipe_separated(indexed_row.get("autores"))
    authors = legacy_authors
    if structured_author.display_name is not None and structured_author.display_name not in authors:
        authors = [structured_author.display_name, *authors]

    return CatalogImportRowPayload(
        title=_required_text(indexed_row.get("titulo"), "El titulo es obligatorio."),
        isbn=_optional_text(indexed_row.get("isbn")),
        publication_year=_optional_int(indexed_row.get("anio_publicacion")),
        description=_optional_text(indexed_row.get("descripcion")),
        cover_url=_optional_text(indexed_row.get("url_portada")),
        publisher_name=_optional_text(indexed_row.get("editorial")),
        collection_name=_optional_text(indexed_row.get("coleccion")),
        author_country_name=_optional_text(indexed_row.get("pais_autor")),
        author_sex=_optional_text(indexed_row.get("sexo_autor")),
        primary_author_first_name=structured_author.first_name,
        primary_author_last_name=structured_author.last_name,
        primary_author_display_name=structured_author.display_name,
        authors=authors,
        genre=_optional_text(indexed_row.get("genero_literario")),
        themes=map_theme_candidates(_split_pipe_separated(indexed_row.get("temas") or indexed_row.get("generos"))),
        format=_optional_text(indexed_row.get("formato")) or "physical",
        physical_location=_optional_text(indexed_row.get("ubicacion_fisica")),
        digital_location=_optional_text(indexed_row.get("ubicacion_digital")),
        status=_optional_text(indexed_row.get("estado_copia")) or "available",
        reading_status=_optional_text(indexed_row.get("estado_lectura")) or "pending",
        user_rating=_optional_int(indexed_row.get("valoracion")),
    )


def _validate_payload(payload: CatalogImportRowPayload) -> None:
    BookCreate.model_validate({"library_id": 1, **payload.model_dump()})


def _enrich_payload_from_open_library(
    payload: CatalogImportRowPayload,
    messages: list[str],
) -> CatalogImportRowPayload:
    if payload.isbn is not None and payload.cover_url is not None:
        return payload

    author_name = payload.primary_author_display_name
    if author_name is None and payload.authors:
        author_name = payload.authors[0]

    if author_name is None:
        return payload

    try:
        external_book = lookup_open_library_book_by_metadata(
            title=payload.title,
            author=author_name,
            publisher=payload.publisher_name,
        )
    except ExternalBookLookupNotFoundError:
        messages.append("No se pudo completar ISBN/portada desde Open Library con una coincidencia fiable.")
        return payload
    except ExternalBookLookupServiceError:
        messages.append("No se pudo consultar Open Library para completar ISBN/portada.")
        return payload

    updates: dict[str, Any] = {}
    if payload.isbn is None and external_book.isbn is not None:
        updates["isbn"] = external_book.isbn
    if payload.cover_url is None and external_book.cover_url is not None:
        updates["cover_url"] = external_book.cover_url

    if not updates:
        messages.append("Open Library no devolvio ISBN ni portada para completar la ficha.")
        return payload

    return payload.model_copy(update=updates)


def _existing_library_duplicate_keys(db: Session, *, library_id: int) -> set[tuple[str, str]]:
    copies = db.execute(
        select(Copy)
        .where(Copy.library_id == library_id)
        .options(*COPY_LOAD_OPTIONS)
    ).unique().scalars().all()
    duplicate_keys: set[tuple[str, str]] = set()

    for copy in copies:
        key = _build_duplicate_key_from_book(copy.book)
        if key is not None:
            duplicate_keys.add(key)
        if copy.book.isbn:
            duplicate_keys.add(("isbn", normalize_author_lookup_key(copy.book.isbn) or copy.book.isbn.casefold()))

    return duplicate_keys


def _build_duplicate_key(payload: CatalogImportRowPayload) -> tuple[str, str] | None:
    if payload.isbn:
        normalized_isbn = normalize_author_lookup_key(payload.isbn)
        if normalized_isbn is not None:
            return ("isbn", normalized_isbn)

    normalized_title = normalize_author_lookup_key(payload.title)
    normalized_author = normalize_author_lookup_key(payload.primary_author_display_name)
    if normalized_title is None or normalized_author is None:
        return None

    return ("identity", f"{normalized_title}::{normalized_author}")


def _build_duplicate_key_from_book(book: Book) -> tuple[str, str] | None:
    primary_author = _get_primary_author(book)
    normalized_title = normalize_author_lookup_key(book.title)
    normalized_author = normalize_author_lookup_key(primary_author.display_name if primary_author is not None else None)
    if normalized_title is None or normalized_author is None:
        return None

    return ("identity", f"{normalized_title}::{normalized_author}")


def _get_primary_author(book: Book) -> Author | None:
    if not book.book_authors:
        return None

    return min(
        (relation.author for relation in book.book_authors),
        key=lambda author: author.display_name.casefold(),
    )


def _serialize_authors(book: Book) -> list[str]:
    return [
        relation.author.display_name
        for relation in sorted(book.book_authors, key=lambda item: item.author.display_name.casefold())
    ]


def _normalize_row_keys(row: dict[str, str]) -> dict[str, str]:
    return {_normalize_header(key): value for key, value in row.items()}


def _normalize_header(value: str) -> str:
    without_accents = "".join(
        char
        for char in unicodedata.normalize("NFKD", value.strip())
        if not unicodedata.combining(char)
    )
    return without_accents.casefold().replace(" ", "_")


def _required_text(value: str | None, error_message: str) -> str:
    normalized = _optional_text(value)
    if normalized is None:
        raise ValueError(error_message)
    return normalized


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _optional_int(value: str | None) -> int | None:
    normalized = _optional_text(value)
    if normalized is None:
        return None
    if not normalized.isdigit():
        raise ValueError(f"Numero invalido: {normalized}.")
    return int(normalized)


def _split_pipe_separated(value: str | None) -> list[str]:
    normalized = _optional_text(value)
    if normalized is None:
        return []

    values: list[str] = []
    seen: set[str] = set()
    for item in normalized.split("|"):
        candidate = item.strip()
        if not candidate or is_placeholder_author(candidate):
            continue
        key = candidate.casefold()
        if key in seen:
            continue
        seen.add(key)
        values.append(candidate)
    return values


def _repair_mojibake_text(value: str) -> str:
    repaired = value
    for _ in range(2):
        next_value = _repair_single_mojibake_pass(repaired)
        if next_value == repaired:
            break
        repaired = next_value
    return repaired


def _repair_single_mojibake_pass(value: str) -> str:
    if "Ã" not in value and "Â" not in value:
        return value

    for source_encoding in ("latin-1", "cp1252"):
        try:
            repaired = value.encode(source_encoding).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if repaired != value:
            return repaired

    return value


def _repair_shifted_native_row(indexed_row: dict[str, str]) -> dict[str, str]:
    if _optional_text(indexed_row.get("url_portada")) is not None:
        return indexed_row

    potential_cover_url = _optional_text(indexed_row.get("valoracion"))
    if potential_cover_url is None or not potential_cover_url.startswith(("http://", "https://")):
        return indexed_row

    theme_column = "temas" if "temas" in indexed_row else "generos"
    if _optional_text(indexed_row.get(theme_column)) not in _COPY_FORMAT_VALUES:
        return indexed_row

    if _optional_text(indexed_row.get("ubicacion_digital")) not in _COPY_STATUS_VALUES:
        return indexed_row

    if _optional_text(indexed_row.get("estado_copia")) not in _READING_STATUS_VALUES:
        return indexed_row

    repaired_row = dict(indexed_row)
    repaired_row["url_portada"] = repaired_row.get("valoracion") or ""
    repaired_row["valoracion"] = repaired_row.get("estado_lectura") or ""
    repaired_row["estado_lectura"] = repaired_row.get("estado_copia") or ""
    repaired_row["estado_copia"] = repaired_row.get("ubicacion_digital") or ""
    repaired_row["ubicacion_digital"] = repaired_row.get("ubicacion_fisica") or ""
    repaired_row["ubicacion_fisica"] = repaired_row.get("formato") or ""
    repaired_row["formato"] = repaired_row.get(theme_column) or ""
    repaired_row[theme_column] = repaired_row.get("sexo_autor") or ""
    repaired_row["sexo_autor"] = ""
    return repaired_row
