from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    project_name: str = "Personal Shared Library API"
    project_version: str = "0.1.0"
    database_url: str = (
        "postgresql+psycopg://library_user:library_password@db:5432/library_db"
    )
    secret_key: str = "change-this-in-development"
    access_token_expire_minutes: int = 30
    algorithm: str = "HS256"

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

