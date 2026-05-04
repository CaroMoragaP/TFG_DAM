from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import UniqueConstraint
from sqlalchemy import func
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.book import UserCopy
    from app.models.list import List
    from app.models.library import UserLibrary
    from app.models.social import CopyLoan
    from app.models.social import LibraryEvent
    from app.models.social import Review


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user_libraries: Mapped[list["UserLibrary"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    user_copies: Mapped[list["UserCopy"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    reading_goals: Mapped[list["ReadingGoal"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    lists: Mapped[list["List"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    given_loans: Mapped[list["CopyLoan"]] = relationship(
        back_populates="lender_user",
        foreign_keys="CopyLoan.lender_user_id",
    )
    borrowed_loans: Mapped[list["CopyLoan"]] = relationship(
        back_populates="borrower_user",
        foreign_keys="CopyLoan.borrower_user_id",
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    library_events: Mapped[list["LibraryEvent"]] = relationship(back_populates="actor_user")


class ReadingGoal(Base):
    __tablename__ = "reading_goals"
    __table_args__ = (
        UniqueConstraint("user_id", "year", name="uq_reading_goals_user_id_year"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    target_books: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship(back_populates="reading_goals")
