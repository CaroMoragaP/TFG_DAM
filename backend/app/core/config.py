from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    project_name: str = "Personal Shared Library API"
    project_version: str = "0.1.0"
    environment: str = "development"
    database_url: str = (
        "postgresql+psycopg://library_user:library_password@db:5432/library_db"
    )
    secret_key: str = "change-this-in-development"
    access_token_expire_minutes: int = 30
    algorithm: str = "HS256"
    admin_name: str | None = None
    admin_email: str | None = None
    admin_password: str | None = None
    open_library_user_agent: str = "PersonalSharedLibrary/0.1.0"
    open_library_contact_email: str = "contact@example.com"

    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_secret_key_for_environment(self) -> "Settings":
        normalized_secret_key = self.secret_key.strip()
        if (
            self.environment.casefold() in {"production", "prod"}
            and (
                not normalized_secret_key
                or normalized_secret_key == "change-this-in-development"
            )
        ):
            raise ValueError(
                "SECRET_KEY debe configurarse con un valor seguro cuando ENVIRONMENT=production.",
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
