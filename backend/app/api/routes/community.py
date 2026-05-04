from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import Response
from fastapi import status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.social import CopyCommunityOut
from app.schemas.social import CopyLoanCreate
from app.schemas.social import CopyLoanOut
from app.schemas.social import LibraryActivityPageOut
from app.schemas.social import LibraryReviewFilter
from app.schemas.social import LibraryReviewsPageOut
from app.schemas.social import LibraryReviewSort
from app.schemas.social import ReviewCreate
from app.schemas.social import ReviewOut
from app.schemas.social import ReviewUpdate
from app.services.libraries import LibraryArchivedError
from app.services.libraries import LibraryNotFoundError
from app.services.libraries import LibraryOwnershipRequiredError
from app.services.libraries import LibraryPermissionDeniedError
from app.services.libraries import LibraryRoleRequiredError
from app.services.social import CommunityFeatureUnavailableError
from app.services.social import LoanConflictError
from app.services.social import LoanNotFoundError
from app.services.social import LoanValidationError
from app.services.social import ReviewConflictError
from app.services.social import ReviewNotFoundError
from app.services.social import ReviewPermissionDeniedError
from app.services.social import create_copy_loan
from app.services.social import create_review
from app.services.social import delete_review
from app.services.social import get_copy_community
from app.services.social import list_copy_loans
from app.services.social import list_copy_reviews
from app.services.social import list_library_activity
from app.services.social import list_library_reviews
from app.services.social import return_copy_loan
from app.services.social import update_review

router = APIRouter()


@router.get(
    "/libraries/{library_id}/activity",
    response_model=LibraryActivityPageOut,
    summary="List activity events for a shared library",
)
def read_library_activity(
    library_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryActivityPageOut:
    try:
        return list_library_activity(
            db,
            user_id=current_user.id,
            library_id=library_id,
            limit=limit,
            offset=offset,
        )
    except (LibraryNotFoundError, CommunityFeatureUnavailableError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get(
    "/libraries/{library_id}/reviews",
    response_model=LibraryReviewsPageOut,
    summary="List reviewed shared books for a library wall",
)
def read_library_reviews(
    library_id: int,
    filter: LibraryReviewFilter = Query(default="all"),
    sort: LibraryReviewSort = Query(default="recent"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LibraryReviewsPageOut:
    try:
        return list_library_reviews(
            db,
            user_id=current_user.id,
            library_id=library_id,
            filter_by=filter,
            sort_by=sort,
            limit=limit,
            offset=offset,
        )
    except (LibraryNotFoundError, CommunityFeatureUnavailableError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get(
    "/copies/{copy_id}/community",
    response_model=CopyCommunityOut,
    summary="Get the community summary for a shared copy",
)
def read_copy_community(
    copy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CopyCommunityOut:
    try:
        return get_copy_community(db, user_id=current_user.id, copy_id=copy_id)
    except (LibraryNotFoundError, CommunityFeatureUnavailableError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get(
    "/copies/{copy_id}/reviews",
    response_model=list[ReviewOut],
    summary="List public reviews for a shared copy",
)
def read_copy_reviews(
    copy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReviewOut]:
    try:
        return list_copy_reviews(db, user_id=current_user.id, copy_id=copy_id)
    except (LibraryNotFoundError, CommunityFeatureUnavailableError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/copies/{copy_id}/reviews",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
    summary="Publish a public review for a shared copy",
)
def create_copy_review(
    copy_id: int,
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReviewOut:
    try:
        return create_review(
            db,
            user_id=current_user.id,
            copy_id=copy_id,
            data=payload,
        )
    except (LibraryNotFoundError, CommunityFeatureUnavailableError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ReviewConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch(
    "/reviews/{review_id}",
    response_model=ReviewOut,
    summary="Update your own public review",
)
def update_copy_review(
    review_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReviewOut:
    try:
        return update_review(
            db,
            user_id=current_user.id,
            review_id=review_id,
            data=payload,
        )
    except ReviewNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CommunityFeatureUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError, ReviewPermissionDeniedError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete your own public review",
)
def delete_copy_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        delete_review(
            db,
            user_id=current_user.id,
            review_id=review_id,
        )
    except ReviewNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CommunityFeatureUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError, ReviewPermissionDeniedError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/copies/{copy_id}/loans",
    response_model=list[CopyLoanOut],
    summary="List loan history for a shared copy",
)
def read_copy_loans(
    copy_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CopyLoanOut]:
    try:
        return list_copy_loans(db, user_id=current_user.id, copy_id=copy_id)
    except (LibraryNotFoundError, CommunityFeatureUnavailableError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (LibraryPermissionDeniedError, LibraryRoleRequiredError) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/copies/{copy_id}/loans",
    response_model=CopyLoanOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new loan for a shared copy",
)
def create_loan(
    copy_id: int,
    payload: CopyLoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CopyLoanOut:
    try:
        return create_copy_loan(
            db,
            user_id=current_user.id,
            copy_id=copy_id,
            data=payload,
        )
    except (LibraryNotFoundError, CommunityFeatureUnavailableError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (
        LibraryPermissionDeniedError,
        LibraryRoleRequiredError,
        LibraryOwnershipRequiredError,
    ) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except (LoanConflictError, LoanValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/loans/{loan_id}/return",
    response_model=CopyLoanOut,
    summary="Return an active loan",
)
def return_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CopyLoanOut:
    try:
        return return_copy_loan(
            db,
            user_id=current_user.id,
            loan_id=loan_id,
        )
    except (LoanNotFoundError, CommunityFeatureUnavailableError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except (
        LibraryPermissionDeniedError,
        LibraryRoleRequiredError,
        LibraryOwnershipRequiredError,
    ) as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except LibraryArchivedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except LoanConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
