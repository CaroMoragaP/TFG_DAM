from fastapi import APIRouter

router = APIRouter()


@router.get("/health", summary="Check API status")
def healthcheck() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "backend",
    }

