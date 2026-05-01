from __future__ import annotations

from datetime import date

from pydantic import BaseModel
from pydantic import Field


class StatsBreakdownItemOut(BaseModel):
    key: str
    label: str
    count: int
    percentage: float


class StatsRankingItemOut(BaseModel):
    label: str
    count: int


class CatalogTotalsOut(BaseModel):
    total: int
    physical: int
    digital: int


class CatalogStatsOut(BaseModel):
    totals: CatalogTotalsOut
    author_sex_distribution: list[StatsBreakdownItemOut]
    author_country_distribution: list[StatsBreakdownItemOut]
    genre_distribution: list[StatsBreakdownItemOut]
    publisher_distribution: list[StatsBreakdownItemOut]
    publication_year_distribution: list[StatsBreakdownItemOut]
    top_authors: list[StatsRankingItemOut]
    top_genres: list[StatsRankingItemOut]


class ReadingStatusCountsOut(BaseModel):
    pending: int
    reading: int
    finished: int


class FinishedByYearItemOut(BaseModel):
    year: int
    count: int


class RatingDistributionItemOut(BaseModel):
    rating: int
    count: int
    percentage: float


class RatingSummaryOut(BaseModel):
    average: float | None
    total_rated: int
    distribution: list[RatingDistributionItemOut]


class ReadingActivityOut(BaseModel):
    started: int
    finished: int
    missing_dates: int


class ReadingGoalOut(BaseModel):
    year: int
    target_books: int


class ReadingGoalUpsert(BaseModel):
    year: int = Field(ge=1, le=9999)
    target_books: int = Field(ge=1, le=10000)


class GoalProgressOut(BaseModel):
    target: int
    completed: int
    percentage: float


class MonthlyProgressItemOut(BaseModel):
    month: str
    started: int
    finished: int


class ReadingStreakOut(BaseModel):
    current_months: int
    best_months: int


class StuckBookReminderOut(BaseModel):
    copy_id: int
    book_id: int
    library_id: int
    title: str
    authors: list[str]
    started_on: date
    days_open: int


class RecentFinishOut(BaseModel):
    copy_id: int
    book_id: int
    library_id: int
    title: str
    authors: list[str]
    finished_on: date


class ReadingStatsOut(BaseModel):
    goal_year: int
    goal: ReadingGoalOut | None
    goal_progress: GoalProgressOut
    status_counts: ReadingStatusCountsOut
    monthly_progress: list[MonthlyProgressItemOut]
    streak: ReadingStreakOut
    stuck_reminders: list[StuckBookReminderOut]
    finished_by_year: list[FinishedByYearItemOut]
    rating_summary: RatingSummaryOut
    reading_activity: ReadingActivityOut
    recent_finishes: list[RecentFinishOut]
