from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.author_names import StructuredAuthorName
from app.core.themes import normalize_theme
from app.models.book import Author
from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import Collection
from app.models.book import Country
from app.models.book import Publisher
from app.models.book import Theme

UNSET = object()


@dataclass
class ImportResolverCache:
    publishers: dict[str, Publisher] = field(default_factory=dict)
    collections: dict[str, Collection] = field(default_factory=dict)
    authors: dict[str, Author] = field(default_factory=dict)
    countries: dict[str, Country] = field(default_factory=dict)
    themes: dict[str, Theme] = field(default_factory=dict)
    books_by_isbn: dict[str, Book] = field(default_factory=dict)
    books_by_identity: dict[str, Book] = field(default_factory=dict)

    def clone(self) -> ImportResolverCache:
        return ImportResolverCache(
            publishers=self.publishers.copy(),
            collections=self.collections.copy(),
            authors=self.authors.copy(),
            countries=self.countries.copy(),
            themes=self.themes.copy(),
            books_by_isbn=self.books_by_isbn.copy(),
            books_by_identity=self.books_by_identity.copy(),
        )


def normalize_text_lookup_key(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip().casefold()
    return normalized or None


def resolve_publisher(
    db: Session,
    name: str | None,
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> Publisher | None:
    if name is None:
        return None

    cache_key = normalize_text_lookup_key(name)
    if resolver_cache is not None and cache_key is not None:
        cached_publisher = resolver_cache.publishers.get(cache_key)
        if cached_publisher is not None:
            return cached_publisher

    stmt = select(Publisher).where(func.lower(Publisher.name) == name.lower())
    publisher = db.scalar(stmt)
    if publisher is not None:
        if resolver_cache is not None and cache_key is not None:
            resolver_cache.publishers[cache_key] = publisher
        return publisher

    publisher = Publisher(name=name)
    db.add(publisher)
    db.flush()
    if resolver_cache is not None and cache_key is not None:
        resolver_cache.publishers[cache_key] = publisher
    return publisher


def resolve_collection(
    db: Session,
    name: str | None,
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> Collection | None:
    if name is None:
        return None

    cache_key = normalize_text_lookup_key(name)
    if resolver_cache is not None and cache_key is not None:
        cached_collection = resolver_cache.collections.get(cache_key)
        if cached_collection is not None:
            return cached_collection

    stmt = select(Collection).where(func.lower(Collection.name) == name.lower())
    collection = db.scalar(stmt)
    if collection is not None:
        if resolver_cache is not None and cache_key is not None:
            resolver_cache.collections[cache_key] = collection
        return collection

    collection = Collection(name=name)
    db.add(collection)
    db.flush()
    if resolver_cache is not None and cache_key is not None:
        resolver_cache.collections[cache_key] = collection
    return collection


def resolve_authors(
    db: Session,
    names: list[StructuredAuthorName],
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> list[Author]:
    authors: list[Author] = []

    for name in names:
        if name.display_name is None:
            continue

        cache_key = normalize_text_lookup_key(name.display_name)
        if resolver_cache is not None and cache_key is not None:
            cached_author = resolver_cache.authors.get(cache_key)
            if cached_author is not None:
                authors.append(cached_author)
                continue

        stmt = select(Author).where(func.lower(Author.display_name) == name.display_name.lower())
        author = db.scalar(stmt)
        if author is None:
            author = Author(
                first_name=name.first_name,
                last_name=name.last_name,
                display_name=name.display_name,
            )
            db.add(author)
            db.flush()
        if resolver_cache is not None and cache_key is not None:
            resolver_cache.authors[cache_key] = author
        authors.append(author)

    return authors


def resolve_country(
    db: Session,
    name: str | None,
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> Country | None:
    if name is None:
        return None

    cache_key = normalize_text_lookup_key(name)
    if resolver_cache is not None and cache_key is not None:
        cached_country = resolver_cache.countries.get(cache_key)
        if cached_country is not None:
            return cached_country

    stmt = select(Country).where(func.lower(Country.name) == name.lower())
    country = db.scalar(stmt)
    if country is not None:
        if resolver_cache is not None and cache_key is not None:
            resolver_cache.countries[cache_key] = country
        return country

    country = Country(name=name)
    db.add(country)
    db.flush()
    if resolver_cache is not None and cache_key is not None:
        resolver_cache.countries[cache_key] = country
    return country


def resolve_themes(
    db: Session,
    names: list[str],
    *,
    resolver_cache: ImportResolverCache | None = None,
) -> list[Theme]:
    themes: list[Theme] = []

    for name in names:
        canonical_name = normalize_theme(name)
        if canonical_name is None:
            continue

        if resolver_cache is not None:
            cached_theme = resolver_cache.themes.get(canonical_name)
            if cached_theme is not None:
                themes.append(cached_theme)
                continue

        stmt = select(Theme).where(Theme.name == canonical_name)
        theme = db.scalar(stmt)
        if theme is None:
            theme = Theme(name=canonical_name)
            db.add(theme)
            db.flush()
        if resolver_cache is not None:
            resolver_cache.themes[canonical_name] = theme
        themes.append(theme)

    return themes


def assign_primary_author_metadata(
    book_authors: list[BookAuthor],
    *,
    country: Country | None | object = UNSET,
    sex: str | None | object = UNSET,
) -> None:
    primary_relation = _get_primary_book_author_relation(book_authors)
    if primary_relation is None:
        return

    if country is not UNSET:
        primary_relation.author.country = country
    if sex is not UNSET:
        primary_relation.author.sex = sex


def _get_primary_book_author_relation(book_authors: list[BookAuthor]) -> BookAuthor | None:
    if not book_authors:
        return None

    return min(book_authors, key=lambda item: item.author.display_name.casefold())
