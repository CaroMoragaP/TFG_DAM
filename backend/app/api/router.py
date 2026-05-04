from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.books import router as books_router
from app.api.routes.community import router as community_router
from app.api.routes.copies import router as copies_router
from app.api.routes.external_books import router as external_books_router
from app.api.routes.health import router as health_router
from app.api.routes.libraries import router as libraries_router
from app.api.routes.lists import router as lists_router
from app.api.routes.reading import router as reading_router
from app.api.routes.stats import router as stats_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(books_router, tags=["books"])
api_router.include_router(community_router, tags=["community"])
api_router.include_router(copies_router, tags=["copies"])
api_router.include_router(external_books_router, tags=["external-books"])
api_router.include_router(health_router, tags=["health"])
api_router.include_router(libraries_router, tags=["libraries"])
api_router.include_router(lists_router, tags=["lists"])
api_router.include_router(reading_router, tags=["reading"])
api_router.include_router(stats_router, tags=["stats"])
