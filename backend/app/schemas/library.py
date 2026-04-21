from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel
from pydantic import ConfigDict
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

    model_config = ConfigDict(from_attributes=True)
