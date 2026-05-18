from __future__ import annotations

import os
import subprocess
import sys
import time

from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.exc import OperationalError


DEFAULT_DATABASE_URL = (
    "postgresql+psycopg://library_user:library_password@db:5432/library_db"
)
DEFAULT_MAX_ATTEMPTS = 30
DEFAULT_RETRY_SECONDS = 2.0


def wait_for_database(database_url: str, max_attempts: int, retry_seconds: float) -> None:
    engine = create_engine(database_url, pool_pre_ping=True)

    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print("Database connection is ready.", flush=True)
            return
        except OperationalError as exc:
            if attempt == max_attempts:
                print(
                    f"Database connection failed after {max_attempts} attempts.",
                    flush=True,
                )
                raise

            print(
                "Database not ready yet "
                f"(attempt {attempt}/{max_attempts}): {exc}",
                flush=True,
            )
            time.sleep(retry_seconds)


def run_migrations() -> None:
    subprocess.run(["alembic", "upgrade", "head"], check=True)


def run_server() -> None:
    os.execvp(
        "uvicorn",
        [
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--reload",
        ],
    )


def main() -> None:
    database_url = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    max_attempts = int(os.getenv("DB_CONNECT_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS))
    retry_seconds = float(
        os.getenv("DB_CONNECT_RETRY_SECONDS", DEFAULT_RETRY_SECONDS)
    )

    wait_for_database(
        database_url=database_url,
        max_attempts=max_attempts,
        retry_seconds=retry_seconds,
    )
    run_migrations()
    run_server()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover - startup path
        print(f"Backend startup failed: {exc}", file=sys.stderr, flush=True)
        raise
