from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint
from sqlalchemy import Date
from sqlalchemy import ForeignKey
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.enums import CopyFormat
from app.models.enums import CopyStatus
from app.models.enums import EnumValueType
from app.models.enums import ReadingStatus

if TYPE_CHECKING:
    from app.models.library import Library
    from app.models.list import ListBook
    from app.models.social import CopyLoan
    from app.models.social import LibraryEvent
    from app.models.social import Review
    from app.models.user import User


class Country(Base):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)

    authors: Mapped[list["Author"]] = relationship(back_populates="country")


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    books: Mapped[list["Book"]] = relationship(back_populates="collection")


class Publisher(Base):
    __tablename__ = "publishers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    books: Mapped[list["Book"]] = relationship(back_populates="publisher")


class Author(Base):
    __tablename__ = "authors"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    country_id: Mapped[int | None] = mapped_column(
        ForeignKey("countries.id", ondelete="SET NULL"),
        nullable=True,
    )
    sex: Mapped[str | None] = mapped_column(String(50), nullable=True)

    country: Mapped["Country | None"] = relationship(back_populates="authors")
    book_authors: Mapped[list["BookAuthor"]] = relationship(
        back_populates="author",
        cascade="all, delete-orphan",
    )


class Theme(Base):
    __tablename__ = "themes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)

    book_themes: Mapped[list["BookTheme"]] = relationship(
        back_populates="theme",
        cascade="all, delete-orphan",
    )


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        CheckConstraint(
            "genre IS NULL OR genre IN ('narrativo', 'lírico', 'dramático', 'didáctico')",
            name="ck_books_genre_allowed_values",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    isbn: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    publication_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    publisher_id: Mapped[int | None] = mapped_column(
        ForeignKey("publishers.id", ondelete="SET NULL"),
        nullable=True,
    )
    collection_id: Mapped[int | None] = mapped_column(
        ForeignKey("collections.id", ondelete="SET NULL"),
        nullable=True,
    )
    genre: Mapped[str | None] = mapped_column(String(32), nullable=True)

    publisher: Mapped["Publisher | None"] = relationship(back_populates="books")
    collection: Mapped["Collection | None"] = relationship(back_populates="books")
    book_authors: Mapped[list["BookAuthor"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
    )
    book_themes: Mapped[list["BookTheme"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
    )
    copies: Mapped[list["Copy"]] = relationship(back_populates="book")
    list_entries: Mapped[list["ListBook"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
    )


class BookAuthor(Base):
    __tablename__ = "book_authors"
    __table_args__ = (
        UniqueConstraint("book_id", "author_id", name="uq_book_authors_book_id_author_id"),
    )

    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"),
        primary_key=True,
    )
    author_id: Mapped[int] = mapped_column(
        ForeignKey("authors.id", ondelete="CASCADE"),
        primary_key=True,
    )

    book: Mapped["Book"] = relationship(back_populates="book_authors")
    author: Mapped["Author"] = relationship(back_populates="book_authors")


class BookTheme(Base):
    __tablename__ = "book_themes"
    __table_args__ = (
        UniqueConstraint("book_id", "theme_id", name="uq_book_themes_book_id_theme_id"),
    )

    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"),
        primary_key=True,
    )
    theme_id: Mapped[int] = mapped_column(
        ForeignKey("themes.id", ondelete="CASCADE"),
        primary_key=True,
    )

    book: Mapped["Book"] = relationship(back_populates="book_themes")
    theme: Mapped["Theme"] = relationship(back_populates="book_themes")


class Copy(Base):
    __tablename__ = "copies"
    __table_args__ = (
        UniqueConstraint("book_id", "library_id", name="uq_copies_book_id_library_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
    )
    library_id: Mapped[int] = mapped_column(
        ForeignKey("libraries.id", ondelete="CASCADE"),
        nullable=False,
    )
    format: Mapped[CopyFormat] = mapped_column(
        EnumValueType(CopyFormat),
        nullable=False,
    )
    physical_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    digital_location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[CopyStatus] = mapped_column(
        EnumValueType(CopyStatus),
        nullable=False,
    )

    book: Mapped["Book"] = relationship(back_populates="copies")
    library: Mapped["Library"] = relationship(back_populates="copies")
    user_copies: Mapped[list["UserCopy"]] = relationship(
        back_populates="copy",
        cascade="all, delete-orphan",
    )
    loans: Mapped[list["CopyLoan"]] = relationship(
        back_populates="copy",
        cascade="all, delete-orphan",
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="copy",
        cascade="all, delete-orphan",
    )
    library_events: Mapped[list["LibraryEvent"]] = relationship(back_populates="copy")


class UserCopy(Base):
    __tablename__ = "user_copies"
    __table_args__ = (
        UniqueConstraint("user_id", "copy_id", name="uq_user_copies_user_id_copy_id"),
        CheckConstraint(
            "rating IS NULL OR (rating >= 1 AND rating <= 5)",
            name="ck_user_copies_rating_range",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    copy_id: Mapped[int] = mapped_column(
        ForeignKey("copies.id", ondelete="CASCADE"),
        nullable=False,
    )
    reading_status: Mapped[ReadingStatus] = mapped_column(
        EnumValueType(ReadingStatus),
        nullable=False,
        default=ReadingStatus.PENDING,
    )
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    personal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="user_copies")
    copy: Mapped["Copy"] = relationship(back_populates="user_copies")
