from __future__ import annotations

from datetime import date

from pydantic import BaseModel


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


class RecentFinishOut(BaseModel):
    copy_id: int
    book_id: int
    library_id: int
    title: str
    authors: list[str]
    finished_on: date


class ReadingStatsOut(BaseModel):
    status_counts: ReadingStatusCountsOut
    finished_by_year: list[FinishedByYearItemOut]
    rating_summary: RatingSummaryOut
    reading_activity: ReadingActivityOut
    recent_finishes: list[RecentFinishOut]
