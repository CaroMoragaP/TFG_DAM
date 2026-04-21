from __future__ import annotations

from typing import Any
from enum import Enum

from sqlalchemy import String
from sqlalchemy.types import TypeDecorator


class EnumValueType(TypeDecorator):
    """Persist enum values while remaining compatible with legacy enum names."""

    impl = String
    cache_ok = True

    def __init__(self, enum_cls: type[Enum]) -> None:
        self.enum_cls = enum_cls
        length = max(
            max(len(str(member.value)) for member in enum_cls),
            max(len(member.name) for member in enum_cls),
        )
        super().__init__(length=length)

    def process_bind_param(self, value: Enum | str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        return str(self._coerce(value).value)

    def process_result_value(self, value: str | None, dialect: Any) -> Enum | None:
        if value is None:
            return None
        return self._coerce(value)

    def _coerce(self, value: Enum | str) -> Enum:
        if isinstance(value, self.enum_cls):
            return value

        if not isinstance(value, str):
            raise LookupError(
                f"{value!r} is not a valid value for enum {self.enum_cls.__name__}.",
            )

        normalized = value.strip()
        if not normalized:
            raise LookupError(
                f"{value!r} is not a valid value for enum {self.enum_cls.__name__}.",
            )

        candidates = (
            normalized,
            normalized.lower(),
        )
        for candidate in candidates:
            try:
                return self.enum_cls(candidate)
            except ValueError:
                continue

        try:
            return self.enum_cls[normalized.upper()]
        except KeyError as exc:
            valid_values = ", ".join(str(member.value) for member in self.enum_cls)
            raise LookupError(
                f"{value!r} is not among the defined enum values for "
                f"{self.enum_cls.__name__}. Possible values: {valid_values}",
            ) from exc


class LibraryType(str, Enum):
    PERSONAL = "personal"
    SHARED = "shared"


class UserLibraryRole(str, Enum):
    OWNER = "owner"
    MEMBER = "member"


class ListType(str, Enum):
    WISHLIST = "wishlist"
    PENDING = "pending"
    CUSTOM = "custom"


class CopyFormat(str, Enum):
    PHYSICAL = "physical"
    DIGITAL = "digital"


class CopyStatus(str, Enum):
    AVAILABLE = "available"
    LOANED = "loaned"
    RESERVED = "reserved"


class ReadingStatus(str, Enum):
    PENDING = "pending"
    READING = "reading"
    FINISHED = "finished"
