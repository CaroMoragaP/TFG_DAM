from __future__ import annotations

import re

import httpx

from app.schemas.external_book import ExternalBookLookupOut

OPEN_LIBRARY_BASE_URL = "https://openlibrary.org"
OPEN_LIBRARY_TIMEOUT_SECONDS = 10.0


class ExternalBookLookupNotFoundError(ValueError):
    """Raised when Open Library has no match for the requested book."""


class ExternalBookLookupServiceError(ValueError):
    """Raised when Open Library cannot be reached or returns invalid data."""


def lookup_open_library_book(*, isbn: str | None = None, q: str | None = None) -> ExternalBookLookupOut:
    normalized_isbn = isbn.strip() if isbn else None
    normalized_query = q.strip() if q else None

    if bool(normalized_isbn) == bool(normalized_query):
        raise ValueError("Debes enviar exactamente uno de estos parametros: isbn o q.")

    try:
        with httpx.Client(base_url=OPEN_LIBRARY_BASE_URL, timeout=OPEN_LIBRARY_TIMEOUT_SECONDS) as client:
            if normalized_isbn:
                return _lookup_by_isbn(client, normalized_isbn)
            return _lookup_by_query(client, normalized_query or "")
    except httpx.HTTPError as exc:
        raise ExternalBookLookupServiceError(
            "No se pudo consultar Open Library en este momento.",
        ) from exc


def _lookup_by_isbn(client: httpx.Client, isbn: str) -> ExternalBookLookupOut:
    response = client.get(
        "/api/books",
        params={
            "bibkeys": f"ISBN:{isbn}",
            "format": "json",
            "jscmd": "data",
        },
    )
    response.raise_for_status()

    payload = response.json()
    book_data = payload.get(f"ISBN:{isbn}")
    if not isinstance(book_data, dict):
        raise ExternalBookLookupNotFoundError("No se encontraron resultados en Open Library.")

    title = _clean_text(book_data.get("title"))
    if title is None:
        raise ExternalBookLookupServiceError("Open Library devolvio una respuesta incompleta.")

    return ExternalBookLookupOut(
        title=title,
        authors=_normalize_name_items(book_data.get("authors")),
        publication_year=_extract_year(book_data.get("publish_date")),
        isbn=_extract_identifier_isbn(book_data, fallback=isbn),
        genres=_normalize_name_items(book_data.get("subjects")),
        cover_url=_extract_cover_url(book_data.get("cover")),
        publisher_name=_extract_first_name(book_data.get("publishers")),
    )


def _lookup_by_query(client: httpx.Client, query: str) -> ExternalBookLookupOut:
    response = client.get(
        "/search.json",
        params={"q": query, "limit": 1},
    )
    response.raise_for_status()

    payload = response.json()
    docs = payload.get("docs")
    if not isinstance(docs, list) or not docs:
        raise ExternalBookLookupNotFoundError("No se encontraron resultados en Open Library.")

    first_doc = docs[0]
    if not isinstance(first_doc, dict):
        raise ExternalBookLookupServiceError("Open Library devolvio una respuesta invalida.")

    title = _clean_text(first_doc.get("title"))
    if title is None:
        raise ExternalBookLookupServiceError("Open Library devolvio una respuesta incompleta.")

    return ExternalBookLookupOut(
        title=title,
        authors=_normalize_string_list(first_doc.get("author_name")),
        publication_year=_coerce_int(first_doc.get("first_publish_year")),
        isbn=_extract_first_string(first_doc.get("isbn")),
        genres=_normalize_string_list(first_doc.get("subject")),
        cover_url=_build_cover_url(first_doc.get("cover_i")),
        publisher_name=_extract_first_string(first_doc.get("publisher")),
    )


def _normalize_name_items(value: object) -> list[str]:
    if not isinstance(value, list):
        return []

    normalized_values: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        name = _clean_text(item.get("name"))
        if name is None:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        normalized_values.append(name)
    return normalized_values


def _normalize_string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []

    normalized_values: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        normalized = _clean_text(item)
        if normalized is None:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        normalized_values.append(normalized)
    return normalized_values


def _extract_first_name(value: object) -> str | None:
    items = _normalize_name_items(value)
    return items[0] if items else None


def _extract_identifier_isbn(book_data: dict[str, object], *, fallback: str) -> str | None:
    identifiers = book_data.get("identifiers")
    if not isinstance(identifiers, dict):
        return fallback

    for key in ("isbn_13", "isbn_10"):
        value = identifiers.get(key)
        isbn = _extract_first_string(value)
        if isbn is not None:
            return isbn
    return fallback


def _extract_first_string(value: object) -> str | None:
    if not isinstance(value, list):
        return None
    for item in value:
        if isinstance(item, str):
            normalized = _clean_text(item)
            if normalized is not None:
                return normalized
    return None


def _extract_cover_url(value: object) -> str | None:
    if not isinstance(value, dict):
        return None

    for key in ("large", "medium", "small"):
        url = value.get(key)
        if isinstance(url, str) and url.strip():
            return url.strip()
    return None


def _build_cover_url(value: object) -> str | None:
    cover_id = _coerce_int(value)
    if cover_id is None:
        return None
    return f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"


def _coerce_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _extract_year(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if not isinstance(value, str):
        return None

    match = re.search(r"(1[0-9]{3}|20[0-9]{2}|2100)", value)
    if match is None:
        return None
    return int(match.group(0))


def _clean_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None
