from collections.abc import Iterator
from contextlib import asynccontextmanager
from contextlib import contextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.admin_seed import seed_development_admin

settings = get_settings()


@contextmanager
def _default_seed_db_factory() -> Iterator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_db_factory = getattr(app.state, "seed_db_factory", _default_seed_db_factory)
    with seed_db_factory() as db:
        seed_development_admin(db, get_settings())
    yield


app = FastAPI(
    title=settings.project_name,
    version=settings.project_version,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)
