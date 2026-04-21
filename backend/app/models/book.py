from __future__ import annotations

from typing import TYPE_CHECKING

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


class Publisher(Base):
    __tablename__ = "publishers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    books: Mapped[list["Book"]] = relationship(back_populates="publisher")


class Author(Base):
    __tablename__ = "authors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    country_of_birth: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sex: Mapped[str | None] = mapped_column(String(50), nullable=True)

    book_authors: Mapped[list["BookAuthor"]] = relationship(
        back_populates="author",
        cascade="all, delete-orphan",
    )


class Genre(Base):
    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)

    book_genres: Mapped[list["BookGenre"]] = relationship(
        back_populates="genre",
        cascade="all, delete-orphan",
    )


class Book(Base):
    __tablename__ = "books"

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

    publisher: Mapped["Publisher | None"] = relationship(back_populates="books")
    book_authors: Mapped[list["BookAuthor"]] = relationship(
        back_populates="book",
        cascade="all, delete-orphan",
    )
    book_genres: Mapped[list["BookGenre"]] = relationship(
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


class BookGenre(Base):
    __tablename__ = "book_genres"
    __table_args__ = (
        UniqueConstraint("book_id", "genre_id", name="uq_book_genres_book_id_genre_id"),
    )

    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"),
        primary_key=True,
    )
    genre_id: Mapped[int] = mapped_column(
        ForeignKey("genres.id", ondelete="CASCADE"),
        primary_key=True,
    )

    book: Mapped["Book"] = relationship(back_populates="book_genres")
    genre: Mapped["Genre"] = relationship(back_populates="book_genres")


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
    reading_status: Mapped[ReadingStatus] = mapped_column(
        EnumValueType(ReadingStatus),
        nullable=False,
    )
    user_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)

    book: Mapped["Book"] = relationship(back_populates="copies")
    library: Mapped["Library"] = relationship(back_populates="copies")
