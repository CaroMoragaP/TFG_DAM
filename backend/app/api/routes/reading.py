from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.enums import ReadingStatus
from app.schemas.reading import ReadingShelfPageOut
from app.services.libraries import LibraryArchivedError
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryPermissionDeniedError
from app.services.libraries import LibraryRoleRequiredError
from app.services.reading import ReadingShelfSort
from app.services.reading import list_reading_shelf_page

router = APIRouter()


@router.get(
    "/reading",
    response_model=ReadingShelfPageOut,
    summary="List the reading shelf for the authenticated user",
)
def read_reading_shelf(
    library_id: int | None = Query(default=None),
    copy_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    reading_status: ReadingStatus | None = Query(default=None),
    sort: ReadingShelfSort = Query(default="title"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadingShelfPageOut:
    try:
        page = list_reading_shelf_page(
            db,
            user_id=current_user.id,
            library_id=library_id,
            copy_id=copy_id,
            q=q,
            reading_status=reading_status,
            sort=sort,
            limit=limit,
            offset=offset,
        )
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return ReadingShelfPageOut(
        items=page.items,
        total=page.total,
        limit=page.limit,
        offset=page.offset,
        status_counts=page.status_counts,
    )
