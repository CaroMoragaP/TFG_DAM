from __future__ import annotations

from datetime import date

from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import model_validator

from app.models.enums import ReadingStatus


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    return normalized or None


class UserCopyOut(BaseModel):
    copy_id: int
    reading_status: ReadingStatus
    rating: int | None
    start_date: date | None
    end_date: date | None
    personal_notes: str | None

    model_config = ConfigDict(from_attributes=True)


class UserCopyUpdate(BaseModel):
    reading_status: ReadingStatus | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    start_date: date | None = None
    end_date: date | None = None
    personal_notes: str | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def normalize_and_validate(self) -> "UserCopyUpdate":
        if "personal_notes" in self.model_fields_set:
            self.personal_notes = _normalize_optional_text(self.personal_notes)

        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("La fecha de fin no puede ser anterior a la de inicio.")

        return self
