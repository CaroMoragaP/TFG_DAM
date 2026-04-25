"""Pydantic schemas package."""

from app.schemas.auth import AuthToken
from app.schemas.auth import UserLogin
from app.schemas.auth import UserRead
from app.schemas.auth import UserRegister
from app.schemas.book import BookCreate
from app.schemas.book import CopyDetailOut
from app.schemas.book import BookOut
from app.schemas.book import BookUpdate
from app.schemas.external_book import ExternalBookLookupOut
from app.schemas.library import LibraryCreate
from app.schemas.library import LibraryOut
from app.schemas.library import LibraryUpdate
from app.schemas.list import ListBookCreate
from app.schemas.list import ListBookSummary
from app.schemas.list import ListCreate
from app.schemas.list import ListOut
from app.schemas.list import ListUpdate
from app.schemas.user_copy import UserCopyOut
from app.schemas.user_copy import UserCopyUpdate

__all__ = [
    "AuthToken",
    "BookCreate",
    "CopyDetailOut",
    "BookOut",
    "BookUpdate",
    "ExternalBookLookupOut",
    "LibraryCreate",
    "LibraryOut",
    "LibraryUpdate",
    "ListBookCreate",
    "ListBookSummary",
    "ListCreate",
    "ListOut",
    "ListUpdate",
    "UserCopyOut",
    "UserCopyUpdate",
    "UserLogin",
    "UserRead",
    "UserRegister",
]
