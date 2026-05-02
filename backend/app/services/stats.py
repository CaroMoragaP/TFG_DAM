from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from datetime import date
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import Session

from app.core.book_fields import normalize_author_sex
from app.models.book import Author
from app.models.book import Book
from app.models.book import BookAuthor
from app.models.book import BookTheme
from app.models.book import Copy
from app.models.book import UserCopy
from app.models.enums import CopyFormat
from app.models.enums import ReadingStatus
from app.models.library import Library
from app.models.library import UserLibrary
from app.models.user import ReadingGoal
from app.schemas.stats import CatalogStatsOut
from app.schemas.stats import CatalogTotalsOut
from app.schemas.stats import FinishedByYearItemOut
from app.schemas.stats import GoalProgressOut
from app.schemas.stats import MonthlyProgressItemOut
from app.schemas.stats import RatingDistributionItemOut
from app.schemas.stats import RatingSummaryOut
from app.schemas.stats import ReadingActivityOut
from app.schemas.stats import ReadingGoalOut
from app.schemas.stats import ReadingGoalUpsert
from app.schemas.stats import ReadingStreakOut
from app.schemas.stats import ReadingStatsOut
from app.schemas.stats import ReadingStatusCountsOut
from app.schemas.stats import RecentFinishOut
from app.schemas.stats import StuckBookReminderOut
from app.schemas.stats import StatsBreakdownItemOut
from app.schemas.stats import StatsRankingItemOut
from app.services.libraries import READ_ACCESS_ROLES
from app.services.libraries import get_accessible_library

COPY_STATS_LOAD_OPTIONS = (
    joinedload(Copy.book).joinedload(Book.collection),
    joinedload(Copy.book).joinedload(Book.publisher),
    joinedload(Copy.book)
    .selectinload(Book.book_authors)
    .joinedload(BookAuthor.author)
    .joinedload(Author.country),
    joinedload(Copy.book).selectinload(Book.book_themes).joinedload(BookTheme.theme),
)

AUTHOR_SEX_LABELS = {
    "male": "Hombre",
    "female": "Mujer",
    "non_binary": "No binario",
    "unknown": "Sin dato",
}

MONTH_LABELS = (
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
)


def get_catalog_stats(
    db: Session,
    *,
    user_id: int,
    library_id: int | None = None,
) -> CatalogStatsOut:
    copies = _get_scoped_catalog_copies(
        db,
        user_id=user_id,
        library_id=library_id,
    )

    total_copies = len(copies)
    totals = CatalogTotalsOut(
        total=total_copies,
        physical=sum(1 for copy in copies if copy.format == CopyFormat.PHYSICAL),
        digital=sum(1 for copy in copies if copy.format == CopyFormat.DIGITAL),
    )

    author_sex_counts = Counter()
    author_country_counts = Counter()
    genre_counts = Counter()
    theme_counts = Counter()
    publisher_counts = Counter()
    publication_year_counts = Counter()
    top_author_counts = Counter()
    top_genre_counts = Counter()
    top_theme_counts = Counter()

    for copy in copies:
        book = copy.book
        primary_author = _get_primary_author(book)

        sex_key = normalize_author_sex(
            primary_author.sex if primary_author is not None else None,
            invalid_fallback="unknown",
        ) or "unknown"
        author_sex_counts[sex_key] += 1

        author_country_counts[
            primary_author.country.name
            if primary_author is not None and primary_author.country is not None
            else "Sin pais"
        ] += 1
        genre_counts[book.genre if book.genre is not None else "Sin genero"] += 1
        publisher_counts[book.publisher.name if book.publisher is not None else "Sin editorial"] += 1
        publication_year_counts[
            str(book.publication_year) if book.publication_year is not None else "Sin ano"
        ] += 1

        if primary_author is not None:
            top_author_counts[primary_author.display_name] += 1
        else:
            top_author_counts["Autor sin registrar"] += 1

        top_genre_counts[book.genre if book.genre is not None else "Sin genero"] += 1

        serialized_themes = _serialize_themes(book)
        if not serialized_themes:
            theme_counts["Sin temas"] += 1
            top_theme_counts["Sin temas"] += 1
        else:
            for theme in serialized_themes:
                theme_counts[theme] += 1
                top_theme_counts[theme] += 1

    return CatalogStatsOut(
        totals=totals,
        author_sex_distribution=[
            StatsBreakdownItemOut(
                key=key,
                label=AUTHOR_SEX_LABELS[key],
                count=author_sex_counts.get(key, 0),
                percentage=_percentage(author_sex_counts.get(key, 0), total_copies),
            )
            for key in ("male", "female", "non_binary", "unknown")
        ],
        author_country_distribution=_build_distribution(author_country_counts, total_copies),
        genre_distribution=_build_distribution(genre_counts, total_copies),
        theme_distribution=_build_distribution(theme_counts, total_copies),
        publisher_distribution=_build_distribution(
            publisher_counts,
            total_copies,
            top_limit=10,
            others_label="Otros",
        ),
        publication_year_distribution=_build_distribution(
            publication_year_counts,
            total_copies,
            sort_key=_publication_year_sort_key,
        ),
        top_authors=_build_ranking(top_author_counts),
        top_genres=_build_ranking(top_genre_counts),
        top_themes=_build_ranking(top_theme_counts),
    )


def get_reading_stats(
    db: Session,
    *,
    user_id: int,
    library_id: int | None = None,
) -> ReadingStatsOut:
    today = date.today()
    current_year = today.year
    rows = _get_scoped_reading_rows(
        db,
        user_id=user_id,
        library_id=library_id,
    )
    goal_rows = rows if library_id is None else _get_scoped_reading_rows(db, user_id=user_id, library_id=None)
    goal = _get_reading_goal(
        db,
        user_id=user_id,
        year=current_year,
    )

    status_counts = Counter(
        (
            user_copy.reading_status if user_copy is not None else ReadingStatus.PENDING
        ).value
        for _copy, user_copy in rows
    )
    finished_by_year = Counter()
    rating_counts = Counter({rating: 0 for rating in range(1, 6)})
    rating_total = 0
    total_rated = 0
    started = 0
    finished = 0
    missing_dates = 0
    monthly_started_counts = Counter()
    monthly_finished_counts = Counter()
    finished_month_indexes: set[int] = set()
    stuck_reminders: list[StuckBookReminderOut] = []
    recent_finishes: list[RecentFinishOut] = []
    stuck_threshold = today - timedelta(days=30)

    for copy, user_copy in rows:
        if user_copy is None:
            missing_dates += 1
            continue

        if user_copy.start_date is not None:
            started += 1
            if user_copy.start_date.year == current_year:
                monthly_started_counts[user_copy.start_date.month] += 1
        if user_copy.end_date is not None:
            finished += 1
            if user_copy.end_date.year == current_year:
                monthly_finished_counts[user_copy.end_date.month] += 1
        if user_copy.start_date is None or user_copy.end_date is None:
            missing_dates += 1

        if user_copy.rating is not None:
            rating_counts[user_copy.rating] += 1
            rating_total += user_copy.rating
            total_rated += 1

        if (
            user_copy.reading_status == ReadingStatus.FINISHED
            and user_copy.end_date is not None
        ):
            finished_by_year[user_copy.end_date.year] += 1
            finished_month_indexes.add(_month_index(user_copy.end_date.year, user_copy.end_date.month))
            recent_finishes.append(
                RecentFinishOut(
                    copy_id=copy.id,
                    book_id=copy.book_id,
                    library_id=copy.library_id,
                    title=copy.book.title,
                    authors=_serialize_authors(copy.book),
                    finished_on=user_copy.end_date,
                ),
            )

        if (
            user_copy.reading_status == ReadingStatus.READING
            and user_copy.end_date is None
            and user_copy.start_date is not None
            and user_copy.start_date <= stuck_threshold
        ):
            stuck_reminders.append(
                StuckBookReminderOut(
                    copy_id=copy.id,
                    book_id=copy.book_id,
                    library_id=copy.library_id,
                    title=copy.book.title,
                    authors=_serialize_authors(copy.book),
                    started_on=user_copy.start_date,
                    days_open=(today - user_copy.start_date).days,
                ),
            )

    recent_finishes.sort(
        key=lambda item: (item.finished_on, item.title.casefold(), item.copy_id),
        reverse=True,
    )
    stuck_reminders.sort(
        key=lambda item: (-item.days_open, item.title.casefold(), item.copy_id),
    )

    goal_target = goal.target_books if goal is not None else 0
    goal_completed = _count_finished_in_year(goal_rows, current_year)

    return ReadingStatsOut(
        goal_year=current_year,
        goal=(
            ReadingGoalOut(
                year=goal.year,
                target_books=goal.target_books,
            )
            if goal is not None
            else None
        ),
        goal_progress=GoalProgressOut(
            target=goal_target,
            completed=goal_completed,
            percentage=_percentage(goal_completed, goal_target),
        ),
        status_counts=ReadingStatusCountsOut(
            pending=status_counts.get(ReadingStatus.PENDING.value, 0),
            reading=status_counts.get(ReadingStatus.READING.value, 0),
            finished=status_counts.get(ReadingStatus.FINISHED.value, 0),
        ),
        monthly_progress=[
            MonthlyProgressItemOut(
                month=label,
                started=monthly_started_counts.get(month_number, 0),
                finished=monthly_finished_counts.get(month_number, 0),
            )
            for month_number, label in enumerate(MONTH_LABELS, start=1)
        ],
        streak=_build_reading_streak(finished_month_indexes, today=today),
        stuck_reminders=stuck_reminders,
        finished_by_year=[
            FinishedByYearItemOut(year=year, count=count)
            for year, count in sorted(finished_by_year.items())
        ],
        rating_summary=RatingSummaryOut(
            average=round(rating_total / total_rated, 2) if total_rated else None,
            total_rated=total_rated,
            distribution=[
                RatingDistributionItemOut(
                    rating=rating,
                    count=rating_counts[rating],
                    percentage=_percentage(rating_counts[rating], total_rated),
                )
                for rating in range(1, 6)
            ],
        ),
        reading_activity=ReadingActivityOut(
            started=started,
            finished=finished,
            missing_dates=missing_dates,
        ),
        recent_finishes=recent_finishes[:5],
    )


def upsert_reading_goal(
    db: Session,
    *,
    user_id: int,
    data: ReadingGoalUpsert,
) -> ReadingGoalOut:
    goal = _get_reading_goal(
        db,
        user_id=user_id,
        year=data.year,
    )
    if goal is None:
        goal = ReadingGoal(
            user_id=user_id,
            year=data.year,
            target_books=data.target_books,
        )
        db.add(goal)
    else:
        goal.target_books = data.target_books

    db.commit()
    db.refresh(goal)
    return ReadingGoalOut(
        year=goal.year,
        target_books=goal.target_books,
    )


def _get_scoped_catalog_copies(
    db: Session,
    *,
    user_id: int,
    library_id: int | None,
) -> list[Copy]:
    if library_id is not None:
        get_accessible_library(
            db,
            user_id=user_id,
            library_id=library_id,
            allowed_roles=READ_ACCESS_ROLES,
        )

    stmt = (
        select(Copy)
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .options(*COPY_STATS_LOAD_OPTIONS)
        .where(
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        )
        .order_by(Copy.id.asc())
    )
    if library_id is not None:
        stmt = stmt.where(Copy.library_id == library_id)

    return list(db.execute(stmt).unique().scalars().all())


def _get_scoped_reading_rows(
    db: Session,
    *,
    user_id: int,
    library_id: int | None,
) -> list[tuple[Copy, UserCopy | None]]:
    if library_id is not None:
        get_accessible_library(
            db,
            user_id=user_id,
            library_id=library_id,
            allowed_roles=READ_ACCESS_ROLES,
        )

    stmt = (
        select(Copy, UserCopy)
        .join(Library, Library.id == Copy.library_id)
        .join(UserLibrary, UserLibrary.library_id == Copy.library_id)
        .outerjoin(
            UserCopy,
            (UserCopy.copy_id == Copy.id) & (UserCopy.user_id == user_id),
        )
        .options(*COPY_STATS_LOAD_OPTIONS)
        .where(
            UserLibrary.user_id == user_id,
            Library.archived_at.is_(None),
        )
        .order_by(Copy.id.asc())
    )
    if library_id is not None:
        stmt = stmt.where(Copy.library_id == library_id)

    return list(db.execute(stmt).unique().all())


def _get_primary_author(book: Book) -> Author | None:
    if not book.book_authors:
        return None

    return min(
        (relation.author for relation in book.book_authors),
        key=lambda author: author.display_name.casefold(),
    )


def _serialize_themes(book: Book) -> list[str]:
    return [
        relation.theme.name
        for relation in sorted(book.book_themes, key=lambda item: item.theme.name.casefold())
    ]


def _get_reading_goal(
    db: Session,
    *,
    user_id: int,
    year: int,
) -> ReadingGoal | None:
    return db.scalar(
        select(ReadingGoal).where(
            ReadingGoal.user_id == user_id,
            ReadingGoal.year == year,
        ),
    )


def _build_distribution(
    counts: Counter[str],
    total: int,
    *,
    top_limit: int | None = None,
    others_label: str = "Otros",
    sort_key=None,
) -> list[StatsBreakdownItemOut]:
    items = _sorted_counter_items(counts, sort_key=sort_key)
    if top_limit is not None and len(items) > top_limit:
        visible_items = items[:top_limit]
        other_count = sum(count for _label, count in items[top_limit:])
        items = visible_items + [(others_label, other_count)]

    return [
        StatsBreakdownItemOut(
            key=str(label),
            label=str(label),
            count=count,
            percentage=_percentage(count, total),
        )
        for label, count in items
    ]


def _build_ranking(
    counts: Counter[str],
    *,
    limit: int = 5,
) -> list[StatsRankingItemOut]:
    return [
        StatsRankingItemOut(label=label, count=count)
        for label, count in _sorted_counter_items(counts)[:limit]
    ]


def _sorted_counter_items(
    counts: Counter[str],
    *,
    sort_key=None,
) -> list[tuple[str, int]]:
    if sort_key is None:
        return sorted(
            counts.items(),
            key=lambda item: (-item[1], item[0].casefold()),
        )

    return sorted(
        counts.items(),
        key=lambda item: sort_key(item[0], item[1]),
    )


def _publication_year_sort_key(label: str, count: int) -> tuple[int, int, str]:
    if label == "Sin ano":
        return (1, 0, label)
    return (0, int(label), label)


def _count_finished_in_year(
    rows: Sequence[tuple[Copy, UserCopy | None]],
    year: int,
) -> int:
    return sum(
        1
        for _copy, user_copy in rows
        if user_copy is not None
        and user_copy.reading_status == ReadingStatus.FINISHED
        and user_copy.end_date is not None
        and user_copy.end_date.year == year
    )


def _build_reading_streak(
    finished_month_indexes: set[int],
    *,
    today: date,
) -> ReadingStreakOut:
    if not finished_month_indexes:
        return ReadingStreakOut(current_months=0, best_months=0)

    sorted_indexes = sorted(finished_month_indexes)
    best_streak = 0
    active_streak = 0
    previous_index: int | None = None

    for month_index in sorted_indexes:
        if previous_index is not None and month_index == previous_index + 1:
            active_streak += 1
        else:
            active_streak = 1
        best_streak = max(best_streak, active_streak)
        previous_index = month_index

    current_streak = 0
    current_month_index = _month_index(today.year, today.month)
    while current_month_index in finished_month_indexes:
        current_streak += 1
        current_month_index -= 1

    return ReadingStreakOut(
        current_months=current_streak,
        best_months=best_streak,
    )


def _percentage(count: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round((count / total) * 100, 2)


def _month_index(year: int, month: int) -> int:
    return (year * 12) + month


def _serialize_authors(book: Book) -> list[str]:
    authors = _sorted_book_authors(book.book_authors)
    return [author.display_name for author in authors]


def _sorted_book_authors(book_authors: Sequence[BookAuthor]) -> list[Author]:
    return sorted(
        (relation.author for relation in book_authors),
        key=lambda author: author.display_name.casefold(),
    )
