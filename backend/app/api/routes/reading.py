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
from app.schemas.reading import ReadingShelfItemOut
from app.services.libraries import LibraryArchivedError
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryPermissionDeniedError
from app.services.libraries import LibraryRoleRequiredError
from app.services.reading import list_reading_shelf

router = APIRouter()


@router.get(
    "/reading",
    response_model=list[ReadingShelfItemOut],
    summary="List the reading shelf for the authenticated user",
)
def read_reading_shelf(
    library_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReadingShelfItemOut]:
    try:
        return list_reading_shelf(
            db,
            user_id=current_user.id,
            library_id=library_id,
        )
    except LibraryNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
