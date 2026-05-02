from __future__ import annotations

from difflib import SequenceMatcher
import re

import httpx

from app.core.author_names import StructuredAuthorName
from app.core.author_names import normalize_author_lookup_key
from app.core.author_names import split_author_name_heuristic
from app.schemas.author import PrimaryAuthorOut
from app.schemas.external_book import ExternalBookLookupOut

OPEN_LIBRARY_BASE_URL = "https://openlibrary.org"
OPEN_LIBRARY_TIMEOUT_SECONDS = 10.0
OPEN_LIBRARY_SEARCH_LIMIT = 10
_NON_ALNUM_RE = re.compile(r"[^0-9a-z]+")


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


def lookup_open_library_book_by_metadata(
    *,
    title: str,
    author: str | None = None,
    publisher: str | None = None,
) -> ExternalBookLookupOut:
    normalized_title = _clean_text(title)
    normalized_author = _clean_text(author)
    normalized_publisher = _clean_text(publisher)

    if normalized_title is None:
        raise ValueError("El titulo es obligatorio para buscar metadatos externos.")

    try:
        with httpx.Client(base_url=OPEN_LIBRARY_BASE_URL, timeout=OPEN_LIBRARY_TIMEOUT_SECONDS) as client:
            return _lookup_by_metadata(
                client,
                title=normalized_title,
                author=normalized_author,
                publisher=normalized_publisher,
            )
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
        primary_author=_build_primary_author(_normalize_name_items(book_data.get("authors"))),
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

    result = _build_search_lookup_output(first_doc)
    if result is None:
        raise ExternalBookLookupServiceError("Open Library devolvio una respuesta incompleta.")
    return result


def _lookup_by_metadata(
    client: httpx.Client,
    *,
    title: str,
    author: str | None,
    publisher: str | None,
) -> ExternalBookLookupOut:
    response = client.get(
        "/search.json",
        params={
            "q": _build_metadata_query(title=title, author=author, publisher=publisher),
            "limit": OPEN_LIBRARY_SEARCH_LIMIT,
        },
    )
    response.raise_for_status()

    payload = response.json()
    docs = payload.get("docs")
    if not isinstance(docs, list) or not docs:
        raise ExternalBookLookupNotFoundError("No se encontraron resultados en Open Library.")

    ranked_candidates: list[tuple[tuple[int, int, int], ExternalBookLookupOut]] = []
    for candidate in docs:
        if not isinstance(candidate, dict):
            continue

        ranking = _rank_metadata_match(
            candidate,
            title=title,
            author=author,
            publisher=publisher,
        )
        if ranking is None:
            continue

        result = _build_search_lookup_output(candidate)
        if result is None:
            continue

        ranked_candidates.append((ranking, result))

    if not ranked_candidates:
        raise ExternalBookLookupNotFoundError("No se encontraron resultados fiables en Open Library.")

    ranked_candidates.sort(key=lambda item: item[0], reverse=True)
    return ranked_candidates[0][1]


def _build_search_lookup_output(doc: dict[str, object]) -> ExternalBookLookupOut | None:
    title = _clean_text(doc.get("title"))
    if title is None:
        return None

    authors = _normalize_string_list(doc.get("author_name"))
    return ExternalBookLookupOut(
        title=title,
        authors=authors,
        primary_author=_build_primary_author(authors),
        publication_year=_coerce_int(doc.get("first_publish_year")),
        isbn=_extract_first_string(doc.get("isbn")),
        genres=_normalize_string_list(doc.get("subject")),
        cover_url=_build_cover_url(doc.get("cover_i")),
        publisher_name=_extract_first_string(doc.get("publisher")),
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


def _build_primary_author(authors: list[str]) -> PrimaryAuthorOut | None:
    if not authors:
        return None

    structured_author = split_author_name_heuristic(authors[0])
    if structured_author.display_name is None:
        return None

    return _serialize_primary_author(structured_author)


def _serialize_primary_author(author: StructuredAuthorName) -> PrimaryAuthorOut:
    return PrimaryAuthorOut(
        first_name=author.first_name,
        last_name=author.last_name,
        display_name=author.display_name or "",
    )


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


def _build_metadata_query(*, title: str, author: str | None, publisher: str | None) -> str:
    return " ".join(
        value
        for value in (title, author, publisher)
        if value is not None
    )


def _rank_metadata_match(
    candidate: dict[str, object],
    *,
    title: str,
    author: str | None,
    publisher: str | None,
) -> tuple[int, int, int] | None:
    candidate_title = _clean_text(candidate.get("title"))
    if candidate_title is None:
        return None

    title_score = _match_score(
        title,
        candidate_title,
        minimum_ratio=0.92,
        minimum_token_overlap=0.8,
        minimum_contained_length=6,
    )
    if title_score < 85:
        return None

    author_score = 0
    if author is not None:
        author_score = _best_match_score(
            author,
            _normalize_string_list(candidate.get("author_name")),
            minimum_ratio=0.9,
            minimum_token_overlap=0.75,
            minimum_contained_length=5,
        )
        if author_score < 85:
            return None

    publisher_score = 0
    if publisher is not None:
        publisher_score = _best_match_score(
            publisher,
            _normalize_string_list(candidate.get("publisher")),
            minimum_ratio=0.88,
            minimum_token_overlap=0.7,
            minimum_contained_length=5,
        )

    return (title_score, author_score, publisher_score)


def _best_match_score(
    expected: str,
    candidates: list[str],
    *,
    minimum_ratio: float,
    minimum_token_overlap: float,
    minimum_contained_length: int,
) -> int:
    return max(
        (
            _match_score(
                expected,
                candidate,
                minimum_ratio=minimum_ratio,
                minimum_token_overlap=minimum_token_overlap,
                minimum_contained_length=minimum_contained_length,
            )
            for candidate in candidates
        ),
        default=0,
    )


def _match_score(
    expected: str,
    candidate: str,
    *,
    minimum_ratio: float,
    minimum_token_overlap: float,
    minimum_contained_length: int,
) -> int:
    normalized_expected = _normalize_match_text(expected)
    normalized_candidate = _normalize_match_text(candidate)
    if normalized_expected is None or normalized_candidate is None:
        return 0

    if normalized_expected == normalized_candidate:
        return 100

    shorter, longer = sorted(
        (normalized_expected, normalized_candidate),
        key=len,
    )
    if len(shorter) >= minimum_contained_length and shorter in longer:
        return 95

    ratio = SequenceMatcher(None, normalized_expected, normalized_candidate).ratio()
    if ratio >= minimum_ratio:
        return int(round(ratio * 100))

    token_overlap = _token_overlap_score(normalized_expected, normalized_candidate)
    if token_overlap >= minimum_token_overlap:
        return int(round(token_overlap * 100))

    return 0


def _token_overlap_score(left: str, right: str) -> float:
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / max(len(left_tokens), len(right_tokens))


def _normalize_match_text(value: str | None) -> str | None:
    normalized = normalize_author_lookup_key(value)
    if normalized is None:
        return None

    compact = _NON_ALNUM_RE.sub(" ", normalized)
    compact = " ".join(compact.split())
    return compact or None
