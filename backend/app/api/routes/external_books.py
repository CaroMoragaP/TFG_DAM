from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import status

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.external_book import ExternalBookLookupOut
from app.services.external_books import ExternalBookLookupNotFoundError
from app.services.external_books import ExternalBookLookupServiceError
from app.services.external_books import lookup_open_library_book
from app.services.external_books import lookup_open_library_book_by_metadata

router = APIRouter()


@router.get(
    "/external/open-library",
    response_model=ExternalBookLookupOut,
    summary="Search book metadata in Open Library",
)
def read_open_library_book(
    isbn: str | None = Query(default=None),
    q: str | None = Query(default=None),
    title: str | None = Query(default=None),
    author: str | None = Query(default=None),
    publisher: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> ExternalBookLookupOut:
    del current_user
    try:
        normalized_isbn = isbn.strip() if isbn is not None else None
        normalized_query = q.strip() if q is not None else None
        normalized_title = title.strip() if title is not None else None
        normalized_author = author.strip() if author is not None else None
        normalized_publisher = publisher.strip() if publisher is not None else None
        has_metadata_search = any(
            value
            for value in (normalized_title, normalized_author, normalized_publisher)
        )

        if normalized_isbn and (normalized_query or has_metadata_search):
            raise ValueError("Debes enviar isbn o una busqueda por texto/metadatos, pero no combinarlos.")

        if normalized_query and has_metadata_search:
            raise ValueError("Debes enviar q o title/author/publisher, pero no ambos modos a la vez.")

        if normalized_isbn:
            return lookup_open_library_book(isbn=normalized_isbn)

        if normalized_query:
            return lookup_open_library_book(q=normalized_query)

        if has_metadata_search:
            if not normalized_title:
                raise ValueError("El titulo es obligatorio cuando buscas por autor o editorial.")

            return lookup_open_library_book_by_metadata(
                title=normalized_title,
                author=normalized_author,
                publisher=normalized_publisher,
            )

        raise ValueError("Debes enviar isbn, q o title.")
    except ExternalBookLookupNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ExternalBookLookupServiceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
