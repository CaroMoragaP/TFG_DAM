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
from app.models.enums import ListType

if TYPE_CHECKING:
    from app.models.book import Book
    from app.models.library import Library
    from app.models.user import User


class List(Base):
    __tablename__ = "lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    library_id: Mapped[int | None] = mapped_column(
        ForeignKey("libraries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[ListType] = mapped_column(
        EnumValueType(ListType),
        nullable=False,
    )
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

    user: Mapped["User"] = relationship(back_populates="lists")
    library: Mapped["Library | None"] = relationship(back_populates="lists")
    books: Mapped[list["ListBook"]] = relationship(
        back_populates="list",
        cascade="all, delete-orphan",
    )


class ListBook(Base):
    __tablename__ = "list_books"
    __table_args__ = (
        UniqueConstraint("list_id", "book_id", name="uq_list_books_list_id_book_id"),
    )

    list_id: Mapped[int] = mapped_column(
        ForeignKey("lists.id", ondelete="CASCADE"),
        primary_key=True,
    )
    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"),
        primary_key=True,
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    list: Mapped["List"] = relationship(back_populates="books")
    book: Mapped["Book"] = relationship(back_populates="list_entries")
