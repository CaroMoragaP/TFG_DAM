from __future__ import annotations

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthToken
from app.schemas.auth import UserLogin
from app.schemas.auth import UserRead
from app.schemas.auth import UserRegister
from app.services.auth import DuplicateEmailError
from app.services.auth import InvalidCredentialsError
from app.services.auth import authenticate_user
from app.services.auth import register_user
from app.core.security import create_access_token

router = APIRouter()


def build_auth_response(user: User) -> AuthToken:
    return AuthToken(
        access_token=create_access_token(user.id),
        user=UserRead.model_validate(user),
    )


@router.post(
    "/register",
    response_model=AuthToken,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
def register(
    payload: UserRegister,
    db: Session = Depends(get_db),
) -> AuthToken:
    try:
        user = register_user(db, payload)
    except DuplicateEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return build_auth_response(user)


@router.post(
    "/login",
    response_model=AuthToken,
    summary="Authenticate an existing user",
)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db),
) -> AuthToken:
    try:
        user = authenticate_user(db, payload)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc

    return build_auth_response(user)


@router.get(
    "/me",
    response_model=UserRead,
    summary="Return the authenticated user",
)
def read_current_user(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
