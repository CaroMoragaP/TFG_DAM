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

router = APIRouter()


@router.get(
    "/external/open-library",
    response_model=ExternalBookLookupOut,
    summary="Search book metadata in Open Library",
)
def read_open_library_book(
    isbn: str | None = Query(default=None),
    q: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> ExternalBookLookupOut:
    del current_user
    try:
        return lookup_open_library_book(isbn=isbn, q=q)
    except ExternalBookLookupNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ExternalBookLookupServiceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
