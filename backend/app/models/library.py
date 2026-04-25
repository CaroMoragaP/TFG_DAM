from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import String
from sqlalchemy import UniqueConstraint
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.enums import EnumValueType
from app.models.enums import LibraryType
from app.models.enums import UserLibraryRole

if TYPE_CHECKING:
    from app.models.book import Copy
    from app.models.user import User


class Library(Base):
    __tablename__ = "libraries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[LibraryType] = mapped_column(
        EnumValueType(LibraryType),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user_libraries: Mapped[list["UserLibrary"]] = relationship(
        back_populates="library",
        cascade="all, delete-orphan",
    )
    copies: Mapped[list["Copy"]] = relationship(
        back_populates="library",
        cascade="all, delete-orphan",
    )


class UserLibrary(Base):
    __tablename__ = "user_libraries"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "library_id",
            name="uq_user_libraries_user_id_library_id",
        ),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    library_id: Mapped[int] = mapped_column(
        ForeignKey("libraries.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[UserLibraryRole] = mapped_column(
        EnumValueType(UserLibraryRole),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="user_libraries")
    library: Mapped["Library"] = relationship(back_populates="user_libraries")
