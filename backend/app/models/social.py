from __future__ import annotations

from datetime import date
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON
from sqlalchemy import CheckConstraint
from sqlalchemy import Date
from sqlalchemy import DateTime
from sqlalchemy import ForeignKey
from sqlalchemy import Index
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import UniqueConstraint
from sqlalchemy import func
from sqlalchemy import text
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.enums import EnumValueType
from app.models.enums import LibraryEventType

if TYPE_CHECKING:
    from app.models.book import Copy
    from app.models.library import Library
    from app.models.user import User


class CopyLoan(Base):
    __tablename__ = "copy_loans"
    __table_args__ = (
        CheckConstraint(
            "borrower_user_id IS NOT NULL OR borrower_name IS NOT NULL",
            name="ck_copy_loans_borrower_required",
        ),
        Index(
            "uq_copy_loans_active_copy",
            "copy_id",
            unique=True,
            sqlite_where=text("returned_at IS NULL"),
            postgresql_where=text("returned_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    copy_id: Mapped[int] = mapped_column(
        ForeignKey("copies.id", ondelete="CASCADE"),
        nullable=False,
    )
    lender_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    borrower_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    borrower_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    loaned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    copy: Mapped["Copy"] = relationship(back_populates="loans")
    lender_user: Mapped["User"] = relationship(
        back_populates="given_loans",
        foreign_keys=[lender_user_id],
    )
    borrower_user: Mapped["User | None"] = relationship(
        back_populates="borrowed_loans",
        foreign_keys=[borrower_user_id],
    )
    library_events: Mapped[list["LibraryEvent"]] = relationship(back_populates="loan")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "copy_id", name="uq_reviews_user_id_copy_id"),
        CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_reviews_rating_range",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    copy_id: Mapped[int] = mapped_column(
        ForeignKey("copies.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    copy: Mapped["Copy"] = relationship(back_populates="reviews")
    user: Mapped["User"] = relationship(back_populates="reviews")
    library_events: Mapped[list["LibraryEvent"]] = relationship(back_populates="review")


class LibraryEvent(Base):
    __tablename__ = "library_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    library_id: Mapped[int] = mapped_column(
        ForeignKey("libraries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    copy_id: Mapped[int | None] = mapped_column(
        ForeignKey("copies.id", ondelete="SET NULL"),
        nullable=True,
    )
    review_id: Mapped[int | None] = mapped_column(
        ForeignKey("reviews.id", ondelete="SET NULL"),
        nullable=True,
    )
    loan_id: Mapped[int | None] = mapped_column(
        ForeignKey("copy_loans.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_type: Mapped[LibraryEventType] = mapped_column(
        EnumValueType(LibraryEventType),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    payload_json: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)

    library: Mapped["Library"] = relationship(back_populates="events")
    actor_user: Mapped["User"] = relationship(back_populates="library_events")
    copy: Mapped["Copy | None"] = relationship(back_populates="library_events")
    review: Mapped["Review | None"] = relationship(back_populates="library_events")
    loan: Mapped["CopyLoan | None"] = relationship(back_populates="library_events")
