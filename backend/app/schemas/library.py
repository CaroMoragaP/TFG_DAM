from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import EmailStr
from pydantic import Field
from pydantic import field_validator

from app.models.enums import LibraryType
from app.models.enums import UserLibraryRole


class LibraryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: LibraryType = LibraryType.SHARED

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("El nombre es obligatorio.")
        return normalized


class LibraryUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("El nombre es obligatorio.")
        return normalized


class LibraryOut(BaseModel):
    id: int
    name: str
    type: LibraryType
    created_at: datetime
    role: UserLibraryRole
    is_archived: bool
    archived_at: datetime | None
    member_count: int
    copy_count: int

    model_config = ConfigDict(from_attributes=True)


class LibraryMemberOut(BaseModel):
    user_id: int
    name: str
    email: EmailStr
    role: UserLibraryRole


class LibraryMemberCreate(BaseModel):
    email: EmailStr
    role: UserLibraryRole

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: UserLibraryRole) -> UserLibraryRole:
        if value == UserLibraryRole.OWNER:
            raise ValueError("No se puede asignar el rol owner desde esta operacion.")
        return value


class LibraryMemberUpdate(BaseModel):
    role: UserLibraryRole

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: UserLibraryRole) -> UserLibraryRole:
        if value == UserLibraryRole.OWNER:
            raise ValueError("No se puede asignar el rol owner desde esta operacion.")
        return value
